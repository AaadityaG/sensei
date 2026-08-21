# Authentication Plan — Google + Email/Password Auth with MongoDB

Simplest secure setup for this stack: **Google Identity Services ID-token flow** + **email/password register & login**, all backed by **MongoDB**, sessions issued as a **JWT in an httpOnly cookie** by FastAPI.

---

## 1. Why This Approach

| Decision | Choice | Why |
|---|---|---|
| Identity provider | Google OAuth **+ email/password** | Google for one-click; email/password for users without Google |
| Google flow | **ID token verification** (GIS button) | No `state`/PKCE/redirect dance. Frontend gets signed `credential`, backend verifies against Google's JWKS |
| App session | **Our own JWT**, not Google's token | We control expiry, claims, revocation. Never use Google's token as a session cookie |
| Token transport | **httpOnly Secure cookie** (not localStorage) | XSS-safe. Works out of the box via the Vite proxy → same-origin → cookies "just work" in dev |
| User storage | **MongoDB** via `motor` (async driver) | Requirement — Mongo collection `users`, Pydantic models, unique indexes on `email` / `google_sub` |
| Passwords | `bcrypt` hashes only | Never store plaintext. Google-only users have `password_hash = None` |
| Signup vs login | **Separate `/auth/register` and `/auth/login`** | Explicit endpoints + shared `/auth/google`; all three issue the same JWT cookie |

---

## 2. User Flow

```
┌──────────────────────────┐
│  /  (PUBLIC LANDING)     │   Unprotected root page.
│  [Login] [Get Started]   │   Buttons → /login and /register
└──────────┬───────────────┘
           ▼
┌──────────────────────────┐    POST /auth/register { name, email, password }
│  /register  (PUBLIC)     │    └─► validate → bcrypt hash → insert user → Set-Cookie
├──────────────────────────┤
│  /login     (PUBLIC)     │    POST /auth/login { email, password }
│  [email/password form]   │    └─► find user → verify hash → Set-Cookie
│  [ G  Continue w/Google] │    POST /auth/google { credential }
└──────────┬───────────────┘    └─► verify ID token → upsert by google_sub/email → Set-Cookie
           ▼
┌──────────────────────────┐
│  /dashboard  (PROTECTED) │   <ProtectedRoute> checks GET /auth/me;
│                          │   if 401 → redirect to /login.
└──────────────────────────┘
```

---

## 3. Prerequisite — Google Cloud Console (one-time, ~5 min)

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an **OAuth client ID** → type **Web application**
3. Authorized JavaScript origins: `http://localhost:5173`
4. Copy the **Client ID** (no client secret needed for this flow)
5. Have a local or Atlas MongoDB URI ready

---

## 4. Backend Changes

### Dependencies

```
pip install motor==3.* google-auth==2.* PyJWT==2.* bcrypt==4.*
```

### New files

```
backend/
├── db/
│   ├── database.py        # AsyncIOMotorClient, get_db() dependency, ensure_indexes()
│   └── models.py          # UserDoc pydantic model + helpers (serialize_user)
├── core/
│   ├── config.py          # Settings: MONGODB_URI, MONGODB_DB_NAME, JWT_SECRET,
│   │                      # GOOGLE_CLIENT_ID
│   └── security.py        # hash_password(), verify_password(), create_jwt(), decode_jwt()
└── auth/
    ├── routes.py          # POST /auth/register, /auth/login, /auth/google,
    │                      # GET /auth/me, POST /auth/logout
    └── deps.py            # get_current_user dependency (reads cookie, decodes JWT,
                           #   loads user from Mongo)
```

### User document (`users` collection)

```python
{
    "_id":          str(uuid4()),
    "google_sub":   str | None,      # stable Google ID (None for password users)
    "email":        str,             # unique index
    "name":         str,
    "picture":      str | None,
    "password_hash": str | None,     # None for Google-only accounts
    "created_at":   datetime,
}
# db/users.create_index("email", unique=True)
# db/users.create_index("google_sub", unique=True, sparse=True)
```

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Body `{ name, email, password }` → 409 if email exists → bcrypt hash → insert → set JWT cookie |
| POST | `/auth/login` | — | Body `{ email, password }` → verify bcrypt hash (generic 401 on any failure) → set JWT cookie |
| POST | `/auth/google` | — | Body `{ credential }`. Verify ID token → upsert user → set JWT cookie |
| GET | `/auth/me` | cookie | Return current user (or 401) — used by frontend guard |
| POST | `/auth/logout` | — | Clear cookie |
| GET | `/health` | — | stays public |

All three login paths end identically:

```python
jwt = create_jwt(sub=user["id"], email=user["email"])
response.set_cookie("access_token", jwt, httponly=True, samesite="lax",
                    secure=not settings.DEBUG, max_age=7*24*3600)
```

### Register/login logic sketch

```python
@router.post("/register")
async def register(body: RegisterIn, response: Response, db=Depends(get_db)):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(409, "Email already registered")
    doc = {
        "_id": str(uuid4()), "email": body.email.lower(), "name": body.name,
        "password_hash": hash_password(body.password),
        "google_sub": None, "picture": None, "created_at": datetime.utcnow(),
    }
    await db.users.insert_one(doc)
    _set_session_cookie(response, doc)
    return serialize_user(doc)

@router.post("/login")
async def login(body: LoginIn, response: Response, db=Depends(get_db)):
    user = await db.users.find_one({"email": body.email.lower()})
    # same generic error whether email missing or wrong password (no user enumeration)
    if not user or not user["password_hash"] \
       or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    _set_session_cookie(response, user)
    return serialize_user(user)
```

### Google verification logic (`POST /auth/google`)

```python
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

info = id_token.verify_oauth2_token(
    body.credential, google_requests.Request(),
    settings.GOOGLE_CLIENT_ID,
)  # raises ValueError on bad signature / wrong aud / expired

# info["sub"], info["email"], info["email_verified"], info["name"], info["picture"]
# reject if not info.get("email_verified")
# upsert: match google_sub first, else link existing email account, else insert new doc
# then issue app JWT cookie (same as above)
```

### API protection — everything else requires auth

Any future route that must be private takes `user = Depends(get_current_user)`.

```python
# auth/deps.py
async def get_current_user(access_token: str | None = Cookie(None, alias="access_token"),
                           db=Depends(get_db)) -> dict:
    if not access_token:
        raise HTTPException(401)
    payload = decode_jwt(access_token)     # validates signature + exp
    user = await db.users.find_one({"_id": payload["sub"]})
    if not user:
        raise HTTPException(401)
    return serialize_user(user)
```

Optionally add a tiny helper router prefix guard so whole feature routers are protected at once:

```python
protected = APIRouter(dependencies=[Depends(get_current_user)])
router.include_router(protected)          # e.g. all /chat/* routes live here
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
│   ├── Landing.tsx         # current App content → public root "/"
│   ├── Login.tsx           # "/login" — email/password form + Google button
│   ├── Register.tsx        # "/register" — signup form + Google button
│   └── Dashboard.tsx       # protected "/dashboard"
├── components/
│   └── ProtectedRoute.tsx  # queries /auth/me, redirects on 401
├── services/
│   └── authApi.ts          # RTK Query: register, login, googleAuth, getMe, logout
└── App.tsx                 # BrowserRouter + GoogleOAuthProvider + Routes
```

### Wiring sketch

```tsx
// main.tsx / App.tsx
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />              {/* PUBLIC root */}
      <Route path="/login" element={<Login />} />           {/* public */}
      <Route path="/register" element={<Register />} />     {/* public */}
      <Route path="/dashboard"
             element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    </Routes>
  </BrowserRouter>
</GoogleOAuthProvider>
```

```tsx
// ProtectedRoute.tsx — gate on /auth/me
const { data, isLoading, isError } = useGetMeQuery();
if (isLoading) return <Spinner />;
if (isError || !data) return <Navigate to="/login" replace />;
return children;
```

```tsx
// Login.tsx
<form onSubmit={login({ email, password }).unwrap().then(() => navigate('/dashboard'))}>…</form>
<GoogleLogin
  onSuccess={({ credential }) => {
    googleAuth({ credential })            // RTK mutation → sets cookie
      .then(() => navigate('/dashboard'))
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
MONGODB_URI=mongodb://localhost:27017        # or mongodb+srv://... (Atlas)
MONGODB_DB_NAME=app
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

- [x] Passwords stored as bcrypt hashes only — never plaintext; Google accounts have `hash = NULL`
- [x] Generic `401 Invalid credentials` on login (no user enumeration); 409 on duplicate register
- [x] Backend verifies ID token signature, `aud == GOOGLE_CLIENT_ID`, `exp`, and `email_verified`
- [x] Session token is our own short-lived JWT — never Google's token
- [x] JWT in `httponly` cookie → unreachable from JS (XSS-safe); add `secure=true` in prod
- [x] `SameSite=Lax` blocks most CSRF; all mutating endpoints are POST
- [x] Unique indexes enforced in Mongo (`email`, sparse-unique `google_sub`) — race-safe upserts
- [x] Every non-auth endpoint depends on `get_current_user` (API protection)
- [x] Frontend guards `/dashboard` via `ProtectedRoute` (route protection); `/`, `/login`, `/register` stay public
- [x] CORS locked to known origins (already configured in `main.py`)
- [ ] Prod hardening later: refresh tokens, CSRF token on cookie, rate-limit `/auth/*`

---

## 8. Build Order (~ half a day)

1. **Prereqs** — Google OAuth client ID (Section 3); running Mongo (local or Atlas free tier)
2. **DB layer** — `db/database.py` (motor client + `ensure_indexes()` on startup), `db/models.py`
3. **Core** — config additions (`MONGODB_URI`, etc.), `security.py` (bcrypt + create/decode JWT)
4. **Auth routes** — `/auth/register`, `/auth/login`, `/auth/google`, `/auth/me`, `/auth/logout`; test in Swagger UI (`/docs`)
5. **Frontend auth** — provider, router (`/` public, `/dashboard` guarded), Landing/Login/Register/Dashboard pages, `ProtectedRoute`
6. **Wire together** — end-to-end: land → register/login (both paths) → dashboard → logout → redirected
7. **Lock down APIs** — convert any real API routes to `Depends(get_current_user)` or mount them under the protected router
