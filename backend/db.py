import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Text, Numeric, Enum, DateTime, ForeignKey, func, text, inspect
from sqlalchemy.orm import sessionmaker, DeclarativeBase, relationship

# Load .env from project root (one level up from backend/)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
load_dotenv(os.path.join(ROOT_DIR, '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in .env")

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    # Resolve relative path consistently regardless of CWD
    rel_path = DATABASE_URL.replace("sqlite:///", "", 1)
    if not os.path.isabs(rel_path):
        if rel_path.startswith("../"):
            abs_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), rel_path))
        else:
            abs_db_path = os.path.abspath(os.path.join(ROOT_DIR, rel_path))
        os.makedirs(os.path.dirname(abs_db_path), exist_ok=True)
        DATABASE_URL = f"sqlite:///{abs_db_path.replace(os.sep, '/')}"
elif DATABASE_URL.startswith("mysql://"):
    DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+pymysql://", 1)

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    tasks_posted = relationship("Task", back_populates="poster", foreign_keys="Task.poster_id")
    tasks_claimed = relationship("Task", back_populates="worker", foreign_keys="Task.worker_id")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    bounty_usdc = Column(Numeric(18, 6), nullable=False)
    status = Column(
        Enum("open", "claimed", "submitted", "approved", "rejected", name="task_status"),
        default="open",
        nullable=False,
    )
    poster_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    proof = Column(Text, nullable=True)
    tx_hash = Column(String(66), nullable=True, comment="On-chain release or latest tx hash")
    fund_tx_hash = Column(String(66), nullable=True, comment="On-chain funding tx hash")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    poster = relationship("User", back_populates="tasks_posted", foreign_keys=[poster_id])
    worker = relationship("User", back_populates="tasks_claimed", foreign_keys=[worker_id])


def init_db():
    """Initializes tables and ensures schema migrations."""
    Base.metadata.create_all(bind=engine)
    try:
        insp = inspect(engine)
        columns = [c["name"] for c in insp.get_columns("tasks")]
        if "fund_tx_hash" not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE tasks ADD COLUMN fund_tx_hash VARCHAR(66)"))
                conn.commit()
    except Exception:
        pass
