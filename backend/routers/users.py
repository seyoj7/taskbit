from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User
from schemas import UserCreate, UserResponse, WalletAuth

router = APIRouter(prefix="/users", tags=["Users"])


# ── Wallet Auth (connect wallet → get or create) ─────────────

@router.post("/auth/wallet", response_model=UserResponse)
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
    user = User(wallet_address=payload.wallet_address)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ── CRUD ──────────────────────────────────────────────────────

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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
    db.commit()
    db.refresh(user)
    return user


@router.get("/", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db)):
    """Return all registered users."""
    return db.query(User).order_by(User.created_at.desc()).all()


@router.get("/wallet/{wallet_address}", response_model=UserResponse)
def get_user_by_wallet(wallet_address: str, db: Session = Depends(get_db)):
    """Look up a user by their wallet address."""
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found for wallet {wallet_address}",
        )
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Fetch a single user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id {user_id} not found",
        )
    return user
