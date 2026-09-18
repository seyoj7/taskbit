from sqlalchemy import Column, Integer, String, Text, Numeric, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wallet_address = Column(String(42), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=True)
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
    tx_hash = Column(String(66), nullable=True, comment="On-chain escrow tx hash")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    poster = relationship("User", back_populates="tasks_posted", foreign_keys=[poster_id])
    worker = relationship("User", back_populates="tasks_claimed", foreign_keys=[worker_id])
