import re
import urllib.request
import urllib.error
import json
from decimal import Decimal
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, status, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
import uvicorn

from db import engine, get_db, Base, User, Task
from escrow import check_escrow_contract_health, get_onchain_escrow_task, verify_payment_release_tx


# ═══════════════════════════════════════════════════════════════
#  Schemas
# ═══════════════════════════════════════════════════════════════

# Ethereum-style wallet address: 0x followed by 40 hex characters
WALLET_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")


def _validate_wallet_address(v: str) -> str:
    """Shared wallet validation logic."""
    if not WALLET_RE.match(v):
        raise ValueError(
            "Invalid wallet address — must be 0x followed by 40 hex characters"
        )
    return v.lower()


# ── User Schemas ──────────────────────────────────────────────

class UserCreate(BaseModel):
    """Request body for registering a new user."""
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


class UserResponse(BaseModel):
    """Serialised user returned by the API."""
    id: int
    wallet_address: str
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


# ═══════════════════════════════════════════════════════════════
#  Verification
# ═══════════════════════════════════════════════════════════════

def verify_github_link(url: str) -> bool:
    """
    Verifies if a provided link is a valid GitHub Pull Request or Commit,
    or otherwise returns HTTP 200 OK for generic links.
    """
    # Check if it's a GitHub PR: https://github.com/{owner}/{repo}/pull/{number}
    pr_match = re.match(r"https://github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)

    if pr_match:
        owner, repo, pull_number = pr_match.groups()
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}"

        req = urllib.request.Request(api_url, headers={'User-Agent': 'Taskbit-Backend'})
        try:
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    # We can enforce that it must be open or merged here, but for now just exists
                    return True
        except urllib.error.URLError:
            return False

    # If not a PR, just check if the URL returns a 200 OK (basic liveness check)
    if not url.startswith('http'):
        url = 'https://' + url

    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Taskbit-Backend'})
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════

def _get_task_or_404(task_id: int, db: Session) -> Task:
    """Fetch a task by ID or raise 404."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with id {task_id} not found",
        )
    return task


def _get_user_by_wallet_or_404(wallet_address: str, db: Session) -> User:
    """Fetch a user by wallet address or raise 404."""
    user = db.query(User).filter(User.wallet_address == wallet_address.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found for wallet {wallet_address}. "
                   "Connect your wallet first via POST /users/auth/wallet",
        )
    return user


def _assert_status(task: Task, expected: str, action: str):
    """Ensure the task is in the expected status for a given action."""
    if task.status != expected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot {action}: task status is '{task.status}', expected '{expected}'",
        )


# ═══════════════════════════════════════════════════════════════
#  App
# ═══════════════════════════════════════════════════════════════

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


# Chrome's Private Network Access (CORS-RFC1918) sends an extra preflight
# header when fetching local addresses. Without this response header the
# browser silently blocks the request with "Failed to fetch".
@app.middleware("http")
async def handle_private_network_access(request: Request, call_next):
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network"):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# ═══════════════════════════════════════════════════════════════
#  Routes — Root
# ═══════════════════════════════════════════════════════════════

@app.get("/")
def root(db: Session = Depends(get_db)):
    return {"message": "Taskbit API is running, and connected to the database!"}


@app.get("/escrow/health")
def escrow_health():
    """Returns Arc Testnet connection and TaskEscrow contract status."""
    return check_escrow_contract_health()


# ═══════════════════════════════════════════════════════════════
#  Routes — Users
# ═══════════════════════════════════════════════════════════════

@app.post("/users/auth/wallet", response_model=UserResponse)
def connect_wallet(payload: WalletAuth, db: Session = Depends(get_db)):
    """
    Connect-wallet auth flow.

    If a user with this wallet already exists → return them (200).
    Otherwise create a new user and return them (200).
    The frontend calls this every time the user connects their wallet.
    """
    user = db.query(User).filter(User.wallet_address == payload.wallet_address).first()
    if user:
        return user

    # First time connecting — auto-register
    try:
        user = User(wallet_address=payload.wallet_address)
        db.add(user)
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        user = db.query(User).filter(User.wallet_address == payload.wallet_address).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not retrieve user after race condition",
            )
    return user


@app.post("/users/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Register a new user by wallet address."""
    existing = db.query(User).filter(User.wallet_address == payload.wallet_address).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this wallet address already exists",
        )

    user = User(
        wallet_address=payload.wallet_address,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this wallet address already exists",
        )
    return user


@app.get("/users/", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db)):
    """Return all registered users."""
    return db.query(User).order_by(User.created_at.desc()).all()


@app.get("/users/wallet/{wallet_address}", response_model=UserResponse)
def get_user_by_wallet(wallet_address: str, db: Session = Depends(get_db)):
    """Look up a user by their wallet address."""
    user = db.query(User).filter(User.wallet_address == wallet_address.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found for wallet {wallet_address}",
        )
    return user


@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Fetch a single user by ID."""
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
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task with a USDC bounty."""
    poster = _get_user_by_wallet_or_404(payload.poster_wallet_address, db)

    task = Task(
        title=payload.title,
        description=payload.description,
        bounty_usdc=payload.bounty_usdc,
        poster_id=poster.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks/", response_model=List[TaskResponse])
def list_tasks(
    task_status: str | None = None,
    db: Session = Depends(get_db),
):
    """Return all tasks, optionally filtered by status."""
    query = db.query(Task)
    if task_status:
        query = query.filter(Task.status == task_status)
    return query.order_by(Task.created_at.desc()).all()


@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Fetch a single task by its ID."""
    return _get_task_or_404(task_id, db)


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
        "onchain": onchain,
    }


# ── Lifecycle: claim → submit → approve / reject ─────────────

@app.patch("/tasks/{task_id}/claim", response_model=TaskResponse)
def claim_task(task_id: int, payload: TaskClaim, db: Session = Depends(get_db)):
    """
    Worker claims an open task.

    Transition: open → claimed
    Auth: caller must NOT be the task poster (can't claim your own task).
    """
    task = _get_task_or_404(task_id, db)
    _assert_status(task, "open", "claim")

    worker = _get_user_by_wallet_or_404(payload.wallet_address, db)

    # Poster cannot claim their own task
    if worker.id == task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot claim your own task",
        )

    task.worker_id = worker.id
    task.status = "claimed"
    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}/submit", response_model=TaskResponse)
def submit_proof(task_id: int, payload: TaskSubmitProof, db: Session = Depends(get_db)):
    """
    Worker submits proof of completed work.

    Transition: claimed → submitted
    Auth: caller must be the assigned worker.
    """
    task = _get_task_or_404(task_id, db)
    _assert_status(task, "claimed", "submit proof")

    worker = _get_user_by_wallet_or_404(payload.wallet_address, db)

    if worker.id != task.worker_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned worker can submit proof",
        )

    # Verify the link is valid (e.g. valid GitHub PR or active website)
    if not verify_github_link(payload.proof):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid proof link. If this is a GitHub PR, ensure the repository is public and the PR exists.",
        )

    task.proof = payload.proof
    task.status = "submitted"
    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}/approve", response_model=TaskResponse)
def approve_task(task_id: int, payload: TaskApprove, db: Session = Depends(get_db)):
    """
    Poster approves the submitted work → triggers escrow release.

    Transition: submitted → approved
    Auth: caller must be the task poster.
    """
    task = _get_task_or_404(task_id, db)
    _assert_status(task, "submitted", "approve")

    poster = _get_user_by_wallet_or_404(payload.wallet_address, db)

    if poster.id != task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the task poster can approve work",
        )

    task.status = "approved"
    if payload.tx_hash:
        worker = db.query(User).filter(User.id == task.worker_id).first()
        worker_wallet = worker.wallet_address if worker else None

        verification = verify_payment_release_tx(
            tx_hash=payload.tx_hash,
            task_id=task.id,
            expected_worker=worker_wallet,
        )
        if not verification.get("verified"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Escrow on-chain verification failed: {verification.get('error')}",
            )
        task.tx_hash = payload.tx_hash

    db.commit()
    db.refresh(task)
    return task


@app.patch("/tasks/{task_id}/reject", response_model=TaskResponse)
def reject_task(task_id: int, payload: TaskReject, db: Session = Depends(get_db)):
    """
    Poster rejects the submitted work → task re-opens for new claims.

    Transition: submitted → rejected (then effectively re-opens)
    Auth: caller must be the task poster.
    """
    task = _get_task_or_404(task_id, db)
    _assert_status(task, "submitted", "reject")

    poster = _get_user_by_wallet_or_404(payload.wallet_address, db)

    if poster.id != task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the task poster can reject work",
        )

    task.status = "rejected"
    task.worker_id = None
    task.proof = None
    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", status_code=status.HTTP_200_OK)
def delete_task(
    task_id: int,
    wallet_address: str = Query(..., description="Wallet address of the task poster"),
    db: Session = Depends(get_db),
):
    """
    Delete a task posted by the user.

    Auth: caller must be the task poster.
    Constraint: Only tasks that are 'open' or 'rejected' can be deleted.
    Tasks that are 'claimed', 'submitted', or 'approved' cannot be deleted.
    """
    task = _get_task_or_404(task_id, db)
    poster = _get_user_by_wallet_or_404(wallet_address.lower(), db)

    if poster.id != task.poster_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the task poster can delete this task",
        )

    if task.status in ("claimed", "submitted"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete task in '{task.status}' status. A worker is currently assigned.",
        )

    if task.status == "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete an already approved/completed task.",
        )

    db.delete(task)
    db.commit()
    return {"message": f"Task #{task_id} successfully deleted", "id": task_id}


# ═══════════════════════════════════════════════════════════════
#  Entry point
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)