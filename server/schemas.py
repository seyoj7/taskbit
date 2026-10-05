import re
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

WALLET_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def _validate_wallet_address(value: str) -> str:
    if not WALLET_RE.match(value):
        raise ValueError(
            "Invalid wallet address \u2014 must be 0x followed by 40 hex characters"
        )
    return value.lower()


class ChallengeRequest(BaseModel):
    wallet_address: str

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)


class ChallengeResponse(BaseModel):
    nonce: str
    message: str
    wallet_address: str


class VerifyRequest(BaseModel):
    wallet_address: str
    signature: str
    nonce: str

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)


class UserResponse(BaseModel):
    id: int
    wallet_address: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class WalletAuth(BaseModel):

    wallet_address: str

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)


# ── Task Schemas ──────────────────────────────────────────────


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    bounty_usdc: Decimal = Field(
        ...,
        gt=0,
        max_digits=18,
        decimal_places=6,
        description="Bounty in USDC (must be > 0)",
    )
    poster_wallet_address: str = Field(..., min_length=42, max_length=42)
    fund_tx_hash: Optional[str] = Field(None, max_length=66)
    expires_at: datetime = Field(..., description="Task expiration timestamp")

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
    id: int
    title: str
    description: Optional[str]
    bounty_usdc: Decimal
    status: str
    poster_id: int
    poster_wallet_address: str
    worker_id: Optional[int]
    proof: Optional[str]
    rejection_reason: Optional[str]
    tx_hash: Optional[str]
    fund_tx_hash: Optional[str]
    refund_tx_hash: Optional[str]
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
    submission_count: int = 0

    model_config = {"from_attributes": True}


class SubmissionResponse(BaseModel):
    id: int
    task_id: int
    worker_id: int
    worker_wallet_address: str = ""
    proof: str
    status: str
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Task Lifecycle Schemas ────────────────────────────────────


class _WalletActionBase(BaseModel):
    wallet_address: str = Field(..., min_length=42, max_length=42)

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        return _validate_wallet_address(v)


class TaskClaim(_WalletActionBase):

    pass


class TaskSubmitProof(_WalletActionBase):
    proof: str = Field(
        ...,
        min_length=1,
        description="Proof of work (GitHub PR, commit, or link)",
    )

    @field_validator("proof")
    @classmethod
    def proof_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Proof must not be blank")
        return v.strip()


class TaskFund(_WalletActionBase):
    fund_tx_hash: str = Field(..., min_length=66, max_length=66)


class TaskApprove(_WalletActionBase):
    submission_id: int = Field(..., description="ID of the submission to approve")
    tx_hash: str = Field(
        ...,
        min_length=66,
        max_length=66,
        description="On-chain releasePayment tx hash (required)",
    )


class TaskReject(_WalletActionBase):
    submission_id: int = Field(..., description="ID of the submission to reject")
    reason: Optional[str] = None


class TaskRefund(_WalletActionBase):
    refund_tx_hash: str = Field(
        ...,
        min_length=66,
        max_length=66,
        description="On-chain refundTask tx hash (required)",
    )


# ── Poster Review Schemas ─────────────────────────────────────


class PosterReviewCreate(BaseModel):
    vote: int = Field(..., description="+1 for upvote, -1 for downvote")
    comment: str = Field(
        ..., min_length=5, max_length=500, description="Required review comment"
    )

    @field_validator("vote")
    @classmethod
    def vote_must_be_valid(cls, v: int) -> int:
        if v not in (1, -1):
            raise ValueError("Vote must be +1 (upvote) or -1 (downvote)")
        return v

    @field_validator("comment")
    @classmethod
    def comment_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Comment must not be blank")
        return v.strip()


class PosterReviewResponse(BaseModel):
    id: int
    submission_id: int
    reviewer_id: int
    reviewer_wallet_address: str = ""
    poster_id: int
    vote: int
    comment: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PosterScoreResponse(BaseModel):
    poster_wallet_address: str
    poster_id: int
    upvotes: int
    downvotes: int
    score: int
    reviews: List[PosterReviewResponse]


# ═══════════════════════════════════════════════════════════════
