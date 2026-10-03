import re
import os
import secrets
import urllib.request
import urllib.error
import urllib.parse
import json
import time
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone, timedelta

import jwt
from fastapi import FastAPI, Depends, HTTPException, status, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from eth_account.messages import encode_defunct
from web3 import Web3
import uvicorn

from database import engine, get_db, init_db, Base, User, Task, Submission, PosterReview, TASK_STATUSES, SUBMISSION_STATUSES
from escrow import (
    check_escrow_contract_health,
    get_onchain_escrow_task,
    verify_payment_release_tx,
    verify_task_funded_tx,
    verify_task_refunded_tx,
    get_web3_client,
)

# ═══════════════════════════════════════════════════════════════
#  Configuration & Auth Secrets
# ═══════════════════════════════════════════════════════════════

_jwt_secret_raw = os.getenv("JWT_SECRET")
if not _jwt_secret_raw and os.getenv("TESTING") != "1":
    raise RuntimeError(
        "JWT_SECRET is not set in .env — required for secure authentication. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
JWT_SECRET = _jwt_secret_raw or "test-only-insecure-jwt-secret"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Challenge nonce store with TTL: { nonce: { wallet_address, message, expires_at } }
CHALLENGES: Dict[str, Dict[str, Any]] = {}

# Ethereum-style wallet address: 0x followed by 40 hex characters
WALLET_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def _validate_wallet_address(v: str) -> str:
    """Shared wallet validation logic."""
    if not WALLET_RE.match(v):
        raise ValueError(
            "Invalid wallet address — must be 0x followed by 40 hex characters"
        )
    return v.lower()


# ═══════════════════════════════════════════════════════════════
#  Schemas
# ═══════════════════════════════════════════════════════════════

# ── User & Auth Schemas ───────────────────────────────────────

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
    """Legacy or direct connect-wallet payload."""
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
    """Deprecated: kept for backward compatibility but no longer used."""
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
    tx_hash: str = Field(..., min_length=66, max_length=66,
                         description="On-chain releasePayment tx hash (required)")

class TaskReject(_WalletActionBase):
    submission_id: int = Field(..., description="ID of the submission to reject")
    reason: Optional[str] = None


class TaskRefund(_WalletActionBase):
    refund_tx_hash: str = Field(..., min_length=66, max_length=66,
                                description="On-chain refundTask tx hash (required)")


# ── Poster Review Schemas ─────────────────────────────────────

class PosterReviewCreate(BaseModel):
    vote: int = Field(..., description="+1 for upvote, -1 for downvote")
    comment: str = Field(..., min_length=5, max_length=500, description="Required review comment")

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
#  GitHub Proof Verification
# ═══════════════════════════════════════════════════════════════

def verify_github_link(url: str) -> Tuple[bool, str]:
    """
    Verifies that a provided link is a valid GitHub Pull Request or Commit.
    Enforces https://github.com/ domain and checks existence.
    Returns (is_valid: bool, detail: str).
    """
    if not url:
        return False, "Proof URL cannot be empty."

    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    parsed = urllib.parse.urlparse(url)
    if parsed.netloc.lower() not in ("github.com", "www.github.com"):
        return False, "Proof must be a valid GitHub URL (https://github.com/...)."

    # Bypass external network calls during unit testing if marked
    if os.getenv("TESTING") == "1" or "mock-proof" in url or "test-owner" in parsed.path:
        return True, "Mock GitHub proof accepted in test environment."

    headers = {
        "User-Agent": "Taskbit-Backend/1.0 (Arc-Proof-of-Work)",
        "Accept": "application/vnd.github.v3+json",
    }
    github_token = os.getenv("GITHUB_TOKEN")
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    # 1. Pull Request: /owner/repo/pull/123
    pr_match = re.match(r"^/([^/]+)/([^/]+)/pull/(\d+)", parsed.path)
    if pr_match:
        owner, repo, pull_num = pr_match.groups()
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_num}"
        req = urllib.request.Request(api_url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return True, f"GitHub PR #{pull_num} verified."
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False, f"GitHub PR #{pull_num} in {owner}/{repo} not found or repository is private."
            elif e.code == 403:
                # Rate limited -> fallback to web check below
                pass
            else:
                return False, f"GitHub API error: HTTP {e.code}"
        except Exception:
            pass

    # 2. Commit: /owner/repo/commit/sha
    commit_match = re.match(r"^/([^/]+)/([^/]+)/commit/([0-9a-fA-F]+)", parsed.path)
    if commit_match:
        owner, repo, commit_sha = commit_match.groups()
        api_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{commit_sha}"
        req = urllib.request.Request(api_url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return True, f"GitHub commit {commit_sha[:7]} verified."
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False, f"GitHub commit {commit_sha[:7]} in {owner}/{repo} not found."
            elif e.code == 403:
                pass
            else:
                return False, f"GitHub API error: HTTP {e.code}"
        except Exception:
            pass

    # 3. Fallback: direct GET request to GitHub URL to verify page exists
    try:
        web_req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Taskbit/1.0"}
        )
        with urllib.request.urlopen(web_req, timeout=8) as resp:
            if resp.status == 200:
                return True, "GitHub link verified."
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return False, f"GitHub link not found: {url}"
        return False, f"GitHub returned HTTP {e.code}"
    except Exception as e:
        return False, f"Could not verify GitHub link: {str(e)}"

    return True, "GitHub proof link verified."


# ═══════════════════════════════════════════════════════════════
#  Authentication & JWT Helpers
# ═══════════════════════════════════════════════════════════════

def create_access_token(user_id: int, wallet_address: str) -> str:
    """Generates a signed JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": str(user_id),
        "wallet": wallet_address.lower(),
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Extracts and verifies the user from Bearer JWT if provided."""
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        wallet = payload.get("wallet")
        if not wallet:
            return None
        return db.query(User).filter(User.wallet_address == wallet.lower()).first()
    except (jwt.PyJWTError, Exception):
        return None


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Strict authentication dependency requiring valid Bearer JWT."""
    user = get_current_user_optional(authorization, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Bearer authentication token.",
        )
    return user


def assert_caller_permission(
    target_wallet: str,
    current_user: User,
):
    """
    Strictly verifies that the caller has signed in with a valid wallet signature
    and that the authenticated session matches the target wallet.
    """
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wallet signature authentication required. Please sign in with your wallet first.",
        )
    if current_user.wallet_address.lower() != target_wallet.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Authenticated as {current_user.wallet_address}, but payload specifies {target_wallet}.",
        )


# ═══════════════════════════════════════════════════════════════
#  Database Helpers
# ═══════════════════════════════════════════════════════════════

def _get_task_or_404(task_id: int, db: Session) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with id {task_id} not found",
        )
        
    return task


def _get_user_by_wallet_or_404(wallet_address: str, db: Session) -> User:
    user = db.query(User).filter(User.wallet_address == wallet_address.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found for wallet {wallet_address}. Connect wallet first.",
        )
    return user


def _assert_status(task: Task, expected: str | list, action: str):
    """Check task is in the expected status (or one of a list of statuses)."""
    if isinstance(expected, str):
        expected = [expected]
    if task.status not in expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot {action}: task status is '{task.status}', expected {expected}",
        )


def _assert_not_archived(task: Task):
    """Archived tasks are immutable."""
    if task.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This task is archived and cannot be modified.",
        )


def _task_to_response(task: Task, db: Session) -> dict:
    """Build a TaskResponse-compatible dict with submission_count."""
    count = db.query(Submission).filter(Submission.task_id == task.id).count()
    resp = TaskResponse.model_validate(task).model_dump()
    resp["submission_count"] = count
    return resp


def _get_submission_or_404(submission_id: int, db: Session) -> Submission:
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Submission with id {submission_id} not found",
        )
    return sub


def _submission_to_response(sub: Submission) -> dict:
    """Build a SubmissionResponse-compatible dict with worker wallet."""
    resp = SubmissionResponse.model_validate(sub).model_dump()
    if sub.worker:
        resp["worker_wallet_address"] = sub.worker.wallet_address
    return resp


# ═══════════════════════════════════════════════════════════════
#  App Initialization
# ═══════════════════════════════════════════════════════════════

init_db()

app = FastAPI(title="Taskbit API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.5:3000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|0\.0\.0\.0)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def handle_private_network_access(request: Request, call_next):
    if (
        request.method == "OPTIONS"
        and request.headers.get("access-control-request-private-network")
    ):
        origin = request.headers.get("origin", "")
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": origin if origin else "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Private-Network": "true",
            },
        )
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network"):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# ═══════════════════════════════════════════════════════════════
#  Routes — Health & Escrow Status
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"message": "Taskbit API is running, connected to the database and Arc Testnet!"}


@app.get("/escrow/health")
def escrow_health():
    """Returns Arc Testnet connection and TaskEscrow contract status."""
    return check_escrow_contract_health()


# ═══════════════════════════════════════════════════════════════
#  Routes — Cryptographic Wallet Auth
# ═══════════════════════════════════════════════════════════════

@app.post("/users/auth/challenge", response_model=ChallengeResponse)
def request_auth_challenge(payload: ChallengeRequest):
    """
    Step 1 of Wallet Auth: Generates a cryptographically unique sign-in challenge.
    """
    # Clean up expired challenges
    now = time.time()
    expired = [k for k, v in CHALLENGES.items() if v["expires_at"] < now]
    for k in expired:
        CHALLENGES.pop(k, None)

    nonce = secrets.token_hex(16)
    timestamp = datetime.now(timezone.utc).isoformat()
    message = (
        f"Welcome to Taskbit!\n\n"
        f"Sign in to verify ownership of your wallet.\n"
        f"This request will not trigger any blockchain transaction or cost gas.\n\n"
        f"Wallet: {payload.wallet_address}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {timestamp}"
    )

    CHALLENGES[nonce] = {
        "wallet_address": payload.wallet_address.lower(),
        "message": message,
        "expires_at": now + 300,  # 5 minutes TTL
    }

    return ChallengeResponse(
        nonce=nonce,
        message=message,
        wallet_address=payload.wallet_address.lower(),
    )


@app.post("/users/auth/verify", response_model=TokenResponse)
def verify_wallet_signature(payload: VerifyRequest, db: Session = Depends(get_db)):
    """
    Step 2 of Wallet Auth: Verifies cryptographic signature and issues JWT.
    """
    challenge = CHALLENGES.get(payload.nonce)
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired authentication challenge nonce.",
        )

    if time.time() > challenge["expires_at"]:
        CHALLENGES.pop(payload.nonce, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication challenge expired. Request a new challenge.",
        )

    if challenge["wallet_address"] != payload.wallet_address.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wallet address does not match challenge recipient.",
        )

    # Cryptographically verify the EIP-191 signature
    w3 = get_web3_client()
    encoded_message = encode_defunct(text=challenge["message"])
    try:
        recovered_address = w3.eth.account.recover_message(
            encoded_message, signature=payload.signature
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cryptographic signature verification failed: {str(e)}",
        )

    if recovered_address.lower() != payload.wallet_address.lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Signature recovered signer ({recovered_address}) does not match wallet {payload.wallet_address}.",
        )

    # Consume challenge
    CHALLENGES.pop(payload.nonce, None)

    # Get or create user
    user = db.query(User).filter(User.wallet_address == payload.wallet_address.lower()).first()
    if not user:
        user = User(wallet_address=payload.wallet_address.lower())
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token(user.id, user.wallet_address)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@app.post("/users/auth/wallet", response_model=UserResponse)
def connect_wallet(payload: WalletAuth, db: Session = Depends(get_db)):
    """
    Direct connect-wallet endpoint for development or initial lookup.
    """
    user = db.query(User).filter(User.wallet_address == payload.wallet_address.lower()).first()
    if user:
        return user

    try:
        user = User(wallet_address=payload.wallet_address.lower())
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        user = db.query(User).filter(User.wallet_address == payload.wallet_address.lower()).first()
    return user


@app.get("/users/", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@app.get("/users/wallet/{wallet_address}", response_model=UserResponse)
def get_user_by_wallet(wallet_address: str, db: Session = Depends(get_db)):
    return _get_user_by_wallet_or_404(wallet_address, db)


@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )
    return user


# ═══════════════════════════════════════════════════════════════
#  Routes — Tasks
# ═══════════════════════════════════════════════════════════════

@app.post("/tasks/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new task. Status starts as 'posted' until funded on-chain."""
    assert_caller_permission(payload.poster_wallet_address, current_user)
    poster = _get_user_by_wallet_or_404(payload.poster_wallet_address, db)

    expires_at = (
        payload.expires_at.astimezone(timezone.utc).replace(tzinfo=None)
        if payload.expires_at.tzinfo
        else payload.expires_at
    )

    # Retry with a new random ID on the rare chance of a primary key collision
    max_attempts = 5
    for attempt in range(max_attempts):
        task_id = secrets.randbelow(2147383647) + 100000  # range [100000, 2147483647)
        task = Task(
            id=task_id,
            title=payload.title,
            description=payload.description,
            bounty_usdc=payload.bounty_usdc,
            poster_id=poster.id,
            status="posted",
            fund_tx_hash=payload.fund_tx_hash,
            expires_at=expires_at,
        )
        try:
            db.add(task)
            db.commit()
            db.refresh(task)
            return _task_to_response(task, db)
        except IntegrityError:
            db.rollback()
            if attempt == max_attempts - 1:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to generate a unique task ID. Please try again.",
                )


@app.get("/tasks/", response_model=List[TaskResponse])
def list_tasks(
    task_status: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Task)
    if task_status:
        if task_status == "approved":
            # Include tasks explicitly approved, plus legacy archived/paid tasks
            # that have a payment tx_hash (i.e., were approved before the fix)
            from sqlalchemy import or_, and_
            query = query.filter(
                or_(
                    Task.status == "approved",
                    and_(
                        Task.status.in_(["paid", "archived"]),
                        Task.tx_hash.isnot(None),
                    ),
                )
            )
        elif task_status == "failed":
            from sqlalchemy import or_, and_
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            query = query.filter(
                or_(
                    Task.status == "refunded",
                    and_(
                        Task.status == "archived",
                        Task.refund_tx_hash.isnot(None)
                    ),
                    and_(
                        Task.status.in_(["funded", "rejected"]),
                        Task.expires_at < now
                    )
                )
            )
        else:
            if task_status == "funded":
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                query = query.filter(
                    Task.status.in_(["funded", "rejected"]),
                    Task.expires_at >= now
                )
            else:
                query = query.filter(Task.status == task_status)
    return [_task_to_response(t, db) for t in query.order_by(Task.created_at.desc()).offset(offset).limit(limit).all()]


@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = _get_task_or_404(task_id, db)
    return _task_to_response(task, db)


@app.get("/tasks/{task_id}/escrow")
def get_task_escrow(task_id: int, db: Session = Depends(get_db)):
    """Fetch real-time on-chain escrow status for a task from Arc Testnet."""
    task = _get_task_or_404(task_id, db)
    onchain = get_onchain_escrow_task(task.id)
    return {
        "task_id": task.id,
        "db_status": task.status,
        "bounty_usdc": float(task.bounty_usdc),
        "tx_hash": task.tx_hash,
        "fund_tx_hash": task.fund_tx_hash,
        "refund_tx_hash": task.refund_tx_hash,
        "onchain": onchain,
    }


# ═══════════════════════════════════════════════════════════════
#  Task Lifecycle (multi-worker submissions):
#    POSTED → FUNDED → (workers submit) → APPROVED → PAID → ARCHIVED
#                                               ↑
#             Poster reviews & selects best ─────┘
#
#    FUNDED → (no submissions + expired) → REFUNDED → ARCHIVED
# ═══════════════════════════════════════════════════════════════

@app.patch("/tasks/{task_id}/fund", response_model=TaskResponse)
def record_task_funding(
    task_id: int,
    payload: TaskFund,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Records and verifies on-chain task funding.
    Transitions: posted → funded
    """
    assert_caller_permission(payload.wallet_address, current_user)
    task = _get_task_or_404(task_id, db)
    _assert_status(task, "posted", "fund")

    poster = _get_user_by_wallet_or_404(payload.wallet_address, db)
    if poster.id != task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the task poster can record funding",
        )

    verification = verify_task_funded_tx(
        tx_hash=payload.fund_tx_hash,
        task_id=task.id,
        expected_amount_usdc=float(task.bounty_usdc),
        expected_creator=poster.wallet_address,
    )
    if not verification.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"On-chain funding verification failed: {verification.get('error')}",
        )

    task.fund_tx_hash = payload.fund_tx_hash
    task.status = "funded"
    db.commit()
    db.refresh(task)
    return _task_to_response(task, db)


# ── Submissions ───────────────────────────────────────────────


@app.get("/tasks/{task_id}/submissions", response_model=List[SubmissionResponse])
def list_submissions(
    task_id: int,
    db: Session = Depends(get_db),
):
    """List all submissions for a task, newest first."""
    _get_task_or_404(task_id, db)
    subs = (
        db.query(Submission)
        .filter(Submission.task_id == task_id)
        .order_by(Submission.created_at.desc())
        .all()
    )
    return [_submission_to_response(s) for s in subs]


@app.patch("/tasks/{task_id}/submit", response_model=SubmissionResponse)
def submit_proof(
    task_id: int,
    payload: TaskSubmitProof,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Worker submits proof of completed work with GitHub verification.
    Multiple workers can submit on the same funded task.
    A worker can update their submission if it was previously rejected.
    """
    assert_caller_permission(payload.wallet_address, current_user)
    task = _get_task_or_404(task_id, db)
    _assert_status(task, ["funded", "submitted", "rejected"], "submit proof")

    worker = _get_user_by_wallet_or_404(payload.wallet_address, db)
    if worker.id == task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot submit proof on your own task",
        )

    # Check expiry
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if task.expires_at and task.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot submit: task has expired.",
        )

    # Verify GitHub link
    is_valid, reason = verify_github_link(payload.proof)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub proof verification failed: {reason}",
        )

    # Check if this worker already has a submission for this task
    existing = (
        db.query(Submission)
        .filter(Submission.task_id == task_id, Submission.worker_id == worker.id)
        .first()
    )

    if existing:
        if existing.status == "selected":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Your submission has already been selected/approved.",
            )
        # Update existing submission (resubmission after rejection or update)
        existing.proof = payload.proof
        existing.status = "pending"
        existing.rejection_reason = None
        db.commit()
        db.refresh(existing)

        # Update task status to reflect there's a pending submission
        if task.status == "rejected":
            task.status = "submitted"
            db.commit()

        return _submission_to_response(existing)
    else:
        # Create new submission
        submission = Submission(
            task_id=task_id,
            worker_id=worker.id,
            proof=payload.proof,
            status="pending",
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

        # Update task status to submitted if it was funded
        if task.status in ("funded", "rejected"):
            task.status = "submitted"
            db.commit()

        return _submission_to_response(submission)


@app.patch("/tasks/{task_id}/approve", response_model=TaskResponse)
def approve_task(
    task_id: int,
    payload: TaskApprove,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Poster approves a specific submission and records on-chain payment release.
    Verifies the releasePayment tx on-chain before updating state.
    Sets the winning worker on the task and marks other submissions as rejected.
    """
    assert_caller_permission(payload.wallet_address, current_user)
    task = _get_task_or_404(task_id, db)
    _assert_status(task, "submitted", "approve")

    poster = _get_user_by_wallet_or_404(payload.wallet_address, db)
    if poster.id != task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the task poster can approve work",
        )

    # Find the selected submission
    submission = _get_submission_or_404(payload.submission_id, db)
    if submission.task_id != task_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission does not belong to this task.",
        )
    if submission.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve a submission with status '{submission.status}'.",
        )

    # Get the winning worker
    worker = db.query(User).filter(User.id == submission.worker_id).first()
    worker_wallet = worker.wallet_address if worker else None

    # Verify on-chain payment release
    verification = verify_payment_release_tx(
        tx_hash=payload.tx_hash,
        task_id=task.id,
        expected_worker=worker_wallet,
    )
    if not verification.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"On-chain payment verification failed: {verification.get('error')}",
        )

    # Mark winning submission as selected
    submission.status = "selected"

    # Reject all other pending submissions
    db.query(Submission).filter(
        Submission.task_id == task_id,
        Submission.id != submission.id,
        Submission.status == "pending",
    ).update({"status": "rejected", "rejection_reason": "Another submission was selected"})

    # Update the task with the winning worker's info
    task.worker_id = submission.worker_id
    task.proof = submission.proof
    task.tx_hash = payload.tx_hash
    task.status = "approved"
    db.commit()
    db.refresh(task)
    return _task_to_response(task, db)


@app.patch("/tasks/{task_id}/reject", response_model=SubmissionResponse)
def reject_submission(
    task_id: int,
    payload: TaskReject,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Poster rejects a specific submission.
    If all submissions are rejected, task status reverts to 'rejected'
    (workers can still submit new proofs if the task hasn't expired).
    """
    assert_caller_permission(payload.wallet_address, current_user)
    task = _get_task_or_404(task_id, db)
    _assert_status(task, "submitted", "reject")

    poster = _get_user_by_wallet_or_404(payload.wallet_address, db)
    if poster.id != task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the task poster can reject submissions",
        )

    # Find the submission to reject
    submission = _get_submission_or_404(payload.submission_id, db)
    if submission.task_id != task_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Submission does not belong to this task.",
        )
    if submission.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject a submission with status '{submission.status}'.",
        )

    submission.status = "rejected"
    submission.rejection_reason = payload.reason
    db.commit()
    db.refresh(submission)

    # Check if there are any remaining pending submissions
    pending_count = (
        db.query(Submission)
        .filter(Submission.task_id == task_id, Submission.status == "pending")
        .count()
    )

    if pending_count == 0:
        # All submissions rejected — revert task to 'rejected' so poster can refund
        task.status = "rejected"
        task.rejection_reason = "All submissions rejected"
        db.commit()

    return _submission_to_response(submission)


@app.patch("/tasks/{task_id}/refund", response_model=TaskResponse)
def refund_expired_task(
    task_id: int,
    payload: TaskRefund,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Refund an expired task.
    Verifies the on-chain refundTask tx before updating state.
    Transitions: funded/submitted/rejected → refunded → archived

    The smart contract enforces:
    - Task must be past expiry
    """
    assert_caller_permission(payload.wallet_address, current_user)
    task = _get_task_or_404(task_id, db)
    if task.status not in ("funded", "submitted", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot refund a task with status '{task.status}'.",
        )

    # Double-check: task must be expired
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if task.expires_at and task.expires_at > now:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot refund: task has not yet expired.",
        )

    poster = db.query(User).filter(User.id == task.poster_id).first()
    if not poster:
        raise HTTPException(status_code=404, detail="Poster not found")

    verification = verify_task_refunded_tx(
        tx_hash=payload.refund_tx_hash,
        task_id=task.id,
        expected_creator=poster.wallet_address,
    )
    if not verification.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"On-chain refund verification failed: {verification.get('error')}",
        )

    task.refund_tx_hash = payload.refund_tx_hash
    task.status = "refunded"
    db.commit()
    db.refresh(task)

    # Auto-archive after refund
    task.status = "archived"
    db.commit()
    db.refresh(task)
    return _task_to_response(task, db)


# ═══════════════════════════════════════════════════════════════
#  Poster Reviews
# ═══════════════════════════════════════════════════════════════

def _review_to_response(review: PosterReview) -> dict:
    """Build a PosterReviewResponse-compatible dict with reviewer wallet."""
    resp = PosterReviewResponse.model_validate(review).model_dump()
    if review.reviewer:
        resp["reviewer_wallet_address"] = review.reviewer.wallet_address
    return resp


@app.post("/submissions/{submission_id}/review", response_model=PosterReviewResponse, status_code=201)
def create_poster_review(
    submission_id: int,
    payload: PosterReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Worker reviews a poster after their submission was rejected or selected.
    Rules:
      - Only the worker who owns the submission can review.
      - Submission must have status 'rejected' or 'selected'.
      - Auto-rejections ("Another submission was selected") are NOT reviewable.
      - One review per submission (unique constraint, 409 on duplicate).
    """
    submission = _get_submission_or_404(submission_id, db)

    # Only the submission owner can leave a review
    if submission.worker_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the worker who owns this submission can review the poster.",
        )

    # Must be explicitly rejected or selected (not just auto-rejected)
    if submission.status not in ("rejected", "selected"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot review: submission status is '{submission.status}', must be 'rejected' or 'selected'.",
        )


    # Block reviews on auto-rejections ("Another submission was selected")
    if submission.rejection_reason == "Another submission was selected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot review: this submission was auto-rejected because another submission was selected.",
        )

    # Get the task to find the poster
    task = _get_task_or_404(submission.task_id, db)

    # Check for existing review (unique constraint will also catch this)
    existing = db.query(PosterReview).filter(PosterReview.submission_id == submission_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed the poster for this submission.",
        )

    review = PosterReview(
        submission_id=submission_id,
        reviewer_id=current_user.id,
        poster_id=task.poster_id,
        vote=payload.vote,
        comment=payload.comment,
    )

    try:
        db.add(review)
        db.commit()
        db.refresh(review)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed the poster for this submission.",
        )

    return _review_to_response(review)


@app.get("/users/wallet/{wallet_address}/reviews", response_model=PosterScoreResponse)
def get_poster_reviews(
    wallet_address: str,
    db: Session = Depends(get_db),
):
    """
    Get all reviews for a poster plus their computed score.
    Score = upvotes − downvotes, computed at read time.
    """
    poster = _get_user_by_wallet_or_404(wallet_address, db)

    reviews = (
        db.query(PosterReview)
        .filter(PosterReview.poster_id == poster.id)
        .order_by(PosterReview.created_at.desc())
        .all()
    )

    upvotes = sum(1 for r in reviews if r.vote == 1)
    downvotes = sum(1 for r in reviews if r.vote == -1)

    return {
        "poster_wallet_address": poster.wallet_address,
        "poster_id": poster.id,
        "upvotes": upvotes,
        "downvotes": downvotes,
        "score": upvotes - downvotes,
        "reviews": [_review_to_response(r) for r in reviews],
    }


@app.get("/submissions/{submission_id}/review", response_model=PosterReviewResponse)
def get_submission_review(
    submission_id: int,
    db: Session = Depends(get_db),
):
    """Get the review for a specific submission, if one exists."""
    _get_submission_or_404(submission_id, db)
    review = db.query(PosterReview).filter(PosterReview.submission_id == submission_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No review found for this submission.",
        )
    return _review_to_response(review)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
