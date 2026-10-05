import os
from datetime import datetime
from decimal import Decimal
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    Integer,
    String,
    Text,
    Numeric,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    func,
    text,
    inspect,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, sessionmaker, DeclarativeBase

# Load .env from project root (one level up from backend/)
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set in .env")

engine_kwargs = {"pool_pre_ping": True}
if DATABASE_URL.startswith("postgres://"):
    # SQLAlchemy requires postgresql://, not postgres://
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

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

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    wallet_address: Mapped[str] = mapped_column(String(42), unique=True, nullable=False, index=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    tasks_posted: Mapped[list["Task"]] = relationship(
        "Task", back_populates="poster", foreign_keys="Task.poster_id"
    )
    tasks_claimed: Mapped[list["Task"]] = relationship(
        "Task", back_populates="worker", foreign_keys="Task.worker_id"
    )
    submissions: Mapped[list["Submission"]] = relationship(
        "Submission", back_populates="worker", foreign_keys="Submission.worker_id"
    )


# ── Task Lifecycle (multi-worker submissions) ────────────────
#
#   POSTED → FUNDED → (workers submit) → APPROVED → PAID → ARCHIVED
#                                              ↑
#           Poster reviews & selects best ──────┘
#
#   FUNDED → (no submissions + expired) → REFUNDED → ARCHIVED
#


class AuthChallenge(Base):
    __tablename__ = "auth_challenges"

    nonce: Mapped[str] = mapped_column(String(64), primary_key=True)
    wallet_address: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())


TASK_STATUSES = (
    "posted",  # Task created in DB, not yet funded on-chain
    "funded",  # Escrow funded on-chain, open for workers to submit
    "submitted",  # At least one worker has submitted proof
    "approved",  # Poster approved a submission, pending on-chain payment
    "rejected",  # All submissions rejected; workers can still submit if not expired
    "paid",  # On-chain payment verified, USDC released to worker
    "refunded",  # On-chain refund verified, USDC returned to poster
    "archived",  # Terminal state after payment or refund
)

SUBMISSION_STATUSES = (
    "pending",  # Awaiting poster review
    "selected",  # Poster selected this submission as the winner
    "rejected",  # Poster rejected this submission
)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bounty_usdc: Mapped[Decimal] = mapped_column(Numeric(18, 6), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default="posted",
        nullable=False,
    )
    poster_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    worker_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    proof: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="Reason for rejection, if any"
    )
    tx_hash: Mapped[Optional[str]] = mapped_column(
        String(66), nullable=True, comment="On-chain payment release tx hash"
    )
    fund_tx_hash: Mapped[Optional[str]] = mapped_column(String(66), nullable=True, comment="On-chain funding tx hash")
    refund_tx_hash: Mapped[Optional[str]] = mapped_column(
        String(66), nullable=True, comment="On-chain refund tx hash"
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="Task expiration timestamp")
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    poster: Mapped["User"] = relationship(
        "User", back_populates="tasks_posted", foreign_keys=[poster_id]
    )
    worker: Mapped[Optional["User"]] = relationship(
        "User", back_populates="tasks_claimed", foreign_keys=[worker_id]
    )
    submissions: Mapped[list["Submission"]] = relationship(
        "Submission",
        back_populates="task",
        foreign_keys="Submission.task_id",
        order_by="Submission.created_at.desc()",
    )

    @property
    def poster_wallet_address(self) -> str:
        return self.poster.wallet_address if self.poster else ""


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (UniqueConstraint("task_id", "worker_id", name="uq_task_worker"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    worker_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    proof: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    task: Mapped["Task"] = relationship("Task", back_populates="submissions", foreign_keys=[task_id])
    worker: Mapped["User"] = relationship(
        "User", back_populates="submissions", foreign_keys=[worker_id]
    )
    review: Mapped[Optional["PosterReview"]] = relationship("PosterReview", back_populates="submission", uselist=False)


class PosterReview(Base):
    """Worker's review of a poster after their submission was rejected."""

    __tablename__ = "poster_reviews"
    __table_args__ = (
        UniqueConstraint("submission_id", name="uq_one_review_per_submission"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("submissions.id"), nullable=False, index=True
    )
    reviewer_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        comment="Worker who left the review",
    )
    poster_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, comment="Poster being reviewed"
    )
    vote: Mapped[int] = mapped_column(Integer, nullable=False, comment="+1 upvote or -1 downvote")
    comment: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Required review comment (5-500 chars)"
    )
    created_at: Mapped[Optional[datetime]] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    submission: Mapped["Submission"] = relationship(
        "Submission", back_populates="review", foreign_keys=[submission_id]
    )
    reviewer: Mapped["User"] = relationship("User", foreign_keys=[reviewer_id])
    poster: Mapped["User"] = relationship("User", foreign_keys=[poster_id])


def init_db():  # noqa: C901
    """Initializes tables and ensures schema migrations."""
    Base.metadata.create_all(bind=engine)

    # ── Schema migrations for existing databases ──────────────
    try:
        insp = inspect(engine)
        columns = [c["name"] for c in insp.get_columns("tasks")]

        migrations = {
            "fund_tx_hash": "ALTER TABLE tasks ADD COLUMN fund_tx_hash VARCHAR(66)",
            "expires_at": "ALTER TABLE tasks ADD COLUMN expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP",
            "rejection_reason": "ALTER TABLE tasks ADD COLUMN rejection_reason TEXT",
            "refund_tx_hash": "ALTER TABLE tasks ADD COLUMN refund_tx_hash VARCHAR(66)",
        }

        with engine.connect() as conn:
            for col_name, ddl in migrations.items():
                if col_name not in columns:
                    conn.execute(text(ddl))
            conn.commit()
    except Exception:
        pass
