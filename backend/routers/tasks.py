from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Task, User
from schemas import (
    TaskCreate,
    TaskResponse,
    TaskClaim,
    TaskSubmitProof,
    TaskApprove,
    TaskReject,
)
import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.verification import verify_github_link
from services.escrow import get_onchain_escrow_task, verify_payment_release_tx

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# ── Helpers ───────────────────────────────────────────────────

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
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
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


# ── CRUD ──────────────────────────────────────────────────────

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("/", response_model=List[TaskResponse])
def list_tasks(
    task_status: str | None = None,
    db: Session = Depends(get_db),
):
    """Return all tasks, optionally filtered by status."""
    query = db.query(Task)
    if task_status:
        query = query.filter(Task.status == task_status)
    return query.order_by(Task.created_at.desc()).all()


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Fetch a single task by its ID."""
    return _get_task_or_404(task_id, db)


@router.get("/{task_id}/escrow")
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

@router.patch("/{task_id}/claim", response_model=TaskResponse)
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


@router.patch("/{task_id}/submit", response_model=TaskResponse)
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


@router.patch("/{task_id}/approve", response_model=TaskResponse)
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


@router.patch("/{task_id}/reject", response_model=TaskResponse)
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


@router.delete("/{task_id}", status_code=status.HTTP_200_OK)
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
    poster = _get_user_by_wallet_or_404(wallet_address, db)

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
