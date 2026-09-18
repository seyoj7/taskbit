from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from sqlalchemy.orm import Session
from database import engine, get_db, Base
import models  # noqa: F401 — import so Base.metadata sees all tables
from routers.tasks import router as tasks_router
from routers.users import router as users_router
from services.escrow import check_escrow_contract_health

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Taskbit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(users_router)



@app.get("/")
def root(db: Session = Depends(get_db)):
    return {"message": "Taskbit API is running, and connected to MySQL!"}


@app.get("/escrow/health")
def escrow_health():
    """Returns Arc Testnet connection and TaskEscrow contract status."""
    return check_escrow_contract_health()


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)