from fastapi import FastAPI
import sys
import os

# Add the server directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))

from main import app as main_app
from database import init_db

# Initialize database tables if they don't exist
init_db()

# Vercel entrypoint
app = FastAPI()

# Mount the existing FastAPI app under /api so it receives the correct paths
app.mount("/api", main_app)
