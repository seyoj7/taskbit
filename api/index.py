from fastapi import FastAPI
import sys
import os

# Add the server directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'server'))

from main import app as main_app
# Vercel entrypoint
app = FastAPI()

# Mount the existing FastAPI app under /api so it receives the correct paths
app.mount("/api", main_app)
