from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings
from contextlib import asynccontextmanager


class Settings(BaseSettings):
    APP_NAME: str = "Sensei"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]
    MONGO_DB: str = ""
    MONGO_DB_NAME: str = "sensei"

    class Config:
        env_file = ".env"


settings = Settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")

    app.state.mongo_client = None
    app.state.mongo_db = None

    if not settings.MONGO_DB:
        print("[MongoDB] MONGO_DB not set — skipping database connection")
    else:
        try:
            print("[MongoDB] Connecting...")
            client = AsyncIOMotorClient(
                settings.MONGO_DB,
                serverSelectionTimeoutMS=8000,
                connectTimeoutMS=10000,
                socketTimeoutMS=10000,
            )
            await client.admin.command("ping")
            app.state.mongo_client = client
            app.state.mongo_db = client[settings.MONGO_DB_NAME]
            hosts = ", ".join(f"{h}:{p}" for h, p in client.nodes)
            print(f"[MongoDB] Connected OK — cluster: {hosts} — db: '{settings.MONGO_DB_NAME}'")
        except Exception as exc:
            print(f"[MongoDB] CONNECTION FAILED: {exc}")

    yield

    if getattr(app.state, "mongo_client", None) is not None:
        app.state.mongo_client.close()
    print("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/")
async def root():
    return {"message": f"Welcome to {settings.APP_NAME}"}
