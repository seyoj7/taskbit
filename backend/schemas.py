import re
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from decimal import Decimal
from typing import Optional

# Ethereum-style wallet address: 0x followed by 40 hex characters
WALLET_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def _validate_wallet_address(v: str) -> str:
    """Shared wallet validation logic."""
    if not WALLET_RE.match(v):
        raise ValueError(
            "Invalid wallet address — must be 0x followed by 40 hex characters"
        )
    return v


# ── User Schemas ──────────────────────────────────────────────

class UserCreate(BaseModel):
    """Request body for registering a new user."""
    wallet_address: str = Field(
        ...,
        min_length=42,
        max_length=42,
        description="Ethereum wallet address (0x + 40 hex chars)",
    )
    username: Optional[str] = Field(None, max_length=100)

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)


class UserResponse(BaseModel):
    """Serialised user returned by the API."""
    id: int
    wallet_address: str
    username: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class WalletAuth(BaseModel):
    """Request body for the connect-wallet auth flow (get-or-create)."""
    wallet_address: str = Field(
        ...,
        min_length=42,
        max_length=42,
        description="Ethereum wallet address (0x + 40 hex chars)",
    )

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)


# ── Task Schemas ──────────────────────────────────────────────

class TaskCreate(BaseModel):
    """Request body for creating a new task."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    bounty_usdc: Decimal = Field(
        ...,
        gt=0,
        max_digits=18,
        decimal_places=6,
        description="Bounty in USDC (must be > 0)",
    )
    poster_wallet_address: str = Field(
        ...,
        min_length=42,
        max_length=42,
        description="Wallet address of the task poster",
    )

    @field_validator("poster_wallet_address")
    @classmethod
    def validate_poster_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title must not be blank")
        return v.strip()


class TaskResponse(BaseModel):
    """Serialised task returned by the API."""
    id: int
    title: str
    description: Optional[str]
    bounty_usdc: Decimal
    status: str
    poster_id: int
    worker_id: Optional[int]
    proof: Optional[str]
    tx_hash: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Task Lifecycle Schemas ────────────────────────────────────

class _WalletActionBase(BaseModel):
    """Base schema for actions that identify the caller by wallet."""
    wallet_address: str = Field(
        ...,
        min_length=42,
        max_length=42,
        description="Wallet address of the caller",
    )

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)


class TaskClaim(_WalletActionBase):
    """Worker claims an open task."""
    pass


class TaskSubmitProof(_WalletActionBase):
    """Worker submits proof of completed work."""
    proof: str = Field(
        ...,
        min_length=1,
        description="Proof of work (URL, commit hash, description, etc.)",
    )

    @field_validator("proof")
    @classmethod
    def proof_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Proof must not be blank")
        return v.strip()


class TaskApprove(_WalletActionBase):
    """Poster approves the submitted work."""
    tx_hash: Optional[str] = Field(
        None,
        max_length=66,
        description="On-chain releasePayment() tx hash (optional, for tracking)",
    )


class TaskReject(_WalletActionBase):
    """Poster rejects the submitted work."""
    reason: Optional[str] = Field(None, description="Optional rejection reason")
