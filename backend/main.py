from fastapi import FastAPI, Depends
import uvicorn
from sqlalchemy.orm import Session
from database import engine, get_db, Base
import models  # noqa: F401 — import so Base.metadata sees all tables
from routers.tasks import router as tasks_router
from routers.users import router as users_router

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Taskbit API")
app.include_router(tasks_router)
app.include_router(users_router)


@app.get("/")
def root(db: Session = Depends(get_db)):
    return {"message": "Taskbit API is running, and connected to MySQL!"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)