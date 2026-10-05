from contextlib import asynccontextmanager

from fastapi import FastAPI
from server.database import init_db
from server.main import app as main_app


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The mounted FastAPI app's lifespan is not run by this wrapper, so ensure
    # the full database schema from the root ASGI app that Vercel starts.
    init_db()
    yield


# Vercel entrypoint
app = FastAPI(lifespan=lifespan)

# Mount the existing FastAPI app under /api so it receives the correct paths
app.mount("/api", main_app)
