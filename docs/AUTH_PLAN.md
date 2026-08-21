# Authentication Plan — Google Sign-In + JWT

Simplest secure setup for this stack: **Google Identity Services ID-token flow** on the frontend, **JWT in an httpOnly cookie** issued by FastAPI. No password storage at all.

---

## 1. Why This Approach

| Decision | Choice | Why |
|---|---|---|
| Identity provider | Google OAuth | Requirement — users sign up / log in with Google |
| Flow | **ID token verification** (GIS button) | Simplest flow: no `state`/PKCE/redirect dance. Frontend receives Google's signed `credential`, backend verifies it against Google's JWKS. One POST endpoint. |
| App session | **Our own JWT**, not Google's token | We control expiry, claims, and revocation. Never trust Google's token as a session cookie. |
| Token transport | **httpOnly Secure cookie** (not localStorage) | Immune to XSS token theft. Works out of the box because the frontend calls the API through the existing Vite proxy → same-origin → cookies "just work" in dev. |
| User storage | SQLite + SQLAlchemy | Matches MVP plan; swap to Postgres later. |
| Signup vs login | **Same endpoint** | With Google-only auth they are one operation: verify identity → upsert user by `google_sub`. |

---

## 2. User Flow

```
┌──────────────────────┐
│  /  (PUBLIC LANDING) │   Unprotected root page.
│  [Sign up]  [Login]  │   Both buttons lead to /login.
└──────────┬───────────┘
           ▼
┌──────────────────────┐    Google renders its own popup.
│  /login              │    onSuccess(credential) ──►
│  [ G  Continue w/ ]  │
└──────────┬───────────┘           POST /auth/google { credential }
           │                       Backend:
           │                         1. verify_oauth2_token (sig, aud, exp)
           │                         2. upsert user (google_sub, email, name)
           ▼                         3. issue app JWT → Set-Cookie httpOnly
┌──────────────────────┐
│  /app  (PROTECTED)   │   Dashboard placeholder (chat comes later).
│                      │   <ProtectedRoute> checks GET /auth/me;
│                      │   if 401 → redirect to /login.
└──────────────────────┘
```

---

## 3. Prerequisite — Google Cloud Console (one-time, ~5 min)

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an **OAuth client ID** → type **Web application**
3. Authorized JavaScript origins: `http://localhost:5173`
4. Copy the **Client ID** (no client secret needed for this flow)

---

## 4. Backend Changes

### Dependencies

```
pip install sqlalchemy==2.* google-auth==2.* PyJWT==2.*
```

### New files

```
backend/
├── db/
│   ├── connection.py     # engine + session (sqlite:///./app.db)
│   └── models.py         # User model
├── core/
│   ├── config.py         # move Settings here; add JWT_SECRET, GOOGLE_CLIENT_ID
│   └── security.py       # create_jwt(), decode_jwt()
└── auth/
    ├── routes.py         # POST /auth/google, POST /auth/logout, GET /auth/me
    └── deps.py           # get_current_user dependency (reads cookie, decodes JWT)
```

### User model

```python
class User(Base):
    __tablename__ = "users"
    id          = Column(String, primary_key=True)      # uuid4
    google_sub  = Column(String, unique=True, index=True)  # stable Google ID
    email       = Column(String, unique=True, index=True)
    name        = Column(String)
    picture     = Column(String, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/google` | — | Body: `{ credential }`. Verify ID token → upsert user → set JWT cookie |
| GET | `/auth/me` | cookie | Return current user (or 401) — used by frontend guard |
| POST | `/auth/logout` | — | Clear cookie |
| GET | `/health` | — | stays public |

### Verification logic (`POST /auth/google`)

```python
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

info = id_token.verify_oauth2_token(
    body.credential, google_requests.Request(),
    settings.GOOGLE_CLIENT_ID,
)  # raises ValueError on bad signature / wrong aud / expired

# info["sub"], info["email"], info["email_verified"], info["name"], info["picture"]
# reject if not info.get("email_verified")
# upsert user by google_sub → jwt = create_jwt(sub=user.id, email=user.email)
# response.set_cookie("access_token", jwt, httponly=True, samesite="lax",
#                     secure=not settings.DEBUG, max_age=7*24*3600)
```

### Protecting everything else

Any future route that must be private takes `user: User = Depends(get_current_user)`.

```python
# auth/deps.py
async def get_current_user(cookie: str | None = Cookie(None, alias="access_token"),
                           db: Session = Depends(get_db)) -> User:
    if not cookie:
        raise HTTPException(401)
    payload = decode_jwt(cookie)          # validates signature + exp
    user = db.get(User, payload["sub"])
    if not user:
        raise HTTPException(401)
    return user
```

---

## 5. Frontend Changes

### Dependency

```
npm install @react-oauth/google react-router-dom
```

### New files

```
frontend/src/
├── pages/
│   ├── Landing.tsx        # current App content → public root "/"
│   ├── Login.tsx          # Google button page "/login"
│   └── Dashboard.tsx      # protected "/app"
├── components/
│   └── ProtectedRoute.tsx # queries /auth/me, redirects on 401
├── services/
│   └── authApi.ts         # RTK Query: googleAuth, getMe, logout
└── App.tsx                # BrowserRouter + GoogleOAuthProvider + Routes
```

### Wiring sketch

```tsx
// main.tsx / App.tsx
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />          {/* public */}
      <Route path="/login" element={<Login />} />       {/* public */}
      <Route path="/app" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    </Routes>
  </BrowserRouter>
</GoogleOAuthProvider>
```

```tsx
// Login.tsx
<GoogleLogin
  onSuccess={({ credential }) => {
    googleAuth({ credential })            // RTK mutation → sets cookie
      .then(() => navigate('/app'))
  }}
/>
```

RTK Query's `fetchBaseQuery` needs one tweak so cookies ride along:

```ts
baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'include' })
```

---

## 6. Environment Variables

**backend/.env**
```
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
JWT_SECRET=<openssl rand -hex 32>
JWT_EXPIRE_DAYS=7
DEBUG=true
ALLOWED_ORIGINS=["http://localhost:5173"]
```

**frontend/.env.local**
```
VITE_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

Add both keys to `.env.example` files. Never commit real values.

---

## 7. Security Checklist

- [x] Backend verifies ID token signature, `aud == GOOGLE_CLIENT_ID`, `exp`, and `email_verified`
- [x] Session token is our own short-lived JWT — never Google's token
- [x] JWT in `httponly` cookie → unreachable from JS (XSS-safe); add `secure=true` in prod
- [x] `SameSite=Lax` blocks most CSRF; all mutating endpoints are POST
- [x] Every non-auth endpoint depends on `get_current_user`
- [x] CORS locked to known origins (already configured in `main.py`)
- [x] No passwords stored → no password-reset/leak surface
- [ ] Prod hardening later: refresh tokens, CSRF token on cookie, rate-limit `/auth/google`

---

## 8. Build Order (~ half a day)

1. **Google Cloud** — create OAuth client ID (Section 3)
2. **DB** — `db/connection.py` + `User` model, auto-create tables on startup
3. **Core** — config additions, `security.py` (create/decode JWT)
4. **Auth routes** — `/auth/google`, `/auth/me`, `/auth/logout`; test in Swagger UI (`/docs`) with a raw credential from [Google's token tool](https://developers.google.com/identity/gsi/web/tools/verify-id-token)
5. **Frontend auth** — provider, router, Landing/Login/Dashboard pages, ProtectedRoute
6. **Wire together** — end-to-end: land → login → dashboard → logout → redirected
7. **Lock down** — convert any real API routes to `Depends(get_current_user)`
