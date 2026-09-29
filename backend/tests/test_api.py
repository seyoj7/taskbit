import os
import tempfile
import pytest
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from eth_account import Account
from eth_account.messages import encode_defunct
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["TESTING"] = "1"

# Temporary SQLite database file for isolated testing
test_db_path = os.path.join(tempfile.gettempdir(), "taskbit_test.db")
if os.path.exists(test_db_path):
    try:
        os.remove(test_db_path)
    except Exception:
        pass

test_engine = create_engine(
    f"sqlite:///{test_db_path}",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)

from database import Base, get_db
from main import app


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def creator_account():
    return Account.create()


@pytest.fixture
def worker_account():
    return Account.create()


def get_auth_token(client: TestClient, account) -> str:
    res = client.post("/users/auth/challenge", json={"wallet_address": account.address})
    assert res.status_code == 200
    data = res.json()
    nonce = data["nonce"]
    message = data["message"]

    encoded = encode_defunct(text=message)
    signed = account.sign_message(encoded)
    sig_hex = signed.signature.hex()
    if not sig_hex.startswith("0x"):
        sig_hex = "0x" + sig_hex

    res2 = client.post(
        "/users/auth/verify",
        json={"wallet_address": account.address, "signature": sig_hex, "nonce": nonce},
    )
    assert res2.status_code == 200
    return res2.json()["access_token"]


def future_expiry() -> str:
    """Returns an ISO-format timestamp 7 days in the future."""
    return (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()


def past_expiry() -> str:
    """Returns an ISO-format timestamp 1 day in the past."""
    return (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()


# ═══════════════════════════════════════════════════════════════
#  Basic Health & Auth Tests
# ═══════════════════════════════════════════════════════════════

def test_root_and_escrow_health(client: TestClient):
    res = client.get("/")
    assert res.status_code == 200
    assert "Taskbit API is running" in res.json()["message"]

    health_res = client.get("/escrow/health")
    assert health_res.status_code == 200
    assert health_res.json()["network"] == "Arc Testnet"


def test_wallet_challenge_and_verification(client: TestClient, creator_account):
    res = client.post("/users/auth/challenge", json={"wallet_address": creator_account.address})
    assert res.status_code == 200
    challenge = res.json()
    assert "nonce" in challenge
    assert creator_account.address.lower() in challenge["message"].lower()

    # Wrong signature should fail
    bad_res = client.post(
        "/users/auth/verify",
        json={
            "wallet_address": creator_account.address,
            "signature": "0x" + "11" * 65,
            "nonce": challenge["nonce"],
        },
    )
    assert bad_res.status_code in (400, 401)

    # Valid signature
    encoded = encode_defunct(text=challenge["message"])
    signed = creator_account.sign_message(encoded)
    sig_hex = signed.signature.hex()
    if not sig_hex.startswith("0x"):
        sig_hex = "0x" + sig_hex

    good_res = client.post(
        "/users/auth/verify",
        json={
            "wallet_address": creator_account.address,
            "signature": sig_hex,
            "nonce": challenge["nonce"],
        },
    )
    assert good_res.status_code == 200
    data = good_res.json()
    assert "access_token" in data
    assert data["user"]["wallet_address"] == creator_account.address.lower()


def test_create_task_fails_without_signin(client: TestClient, creator_account):
    res = client.post(
        "/tasks/",
        json={
            "title": "Unauthenticated Task",
            "description": "Should fail",
            "bounty_usdc": 100.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": future_expiry(),
        },
    )
    assert res.status_code == 401
    assert "Missing or invalid Bearer authentication token" in res.json()["detail"]


# ═══════════════════════════════════════════════════════════════
#  Full Lifecycle: posted → funded → claimed → submitted → paid → archived
# ═══════════════════════════════════════════════════════════════

def test_full_lifecycle_happy_path(
    client: TestClient, creator_account, worker_account
):
    creator_token = get_auth_token(client, creator_account)
    worker_token = get_auth_token(client, worker_account)

    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    # 1. Create Task → status = posted
    create_res = client.post(
        "/tasks/",
        json={
            "title": "Build Arc Bridge",
            "description": "Implement verified smart contract bridge",
            "bounty_usdc": 250.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": future_expiry(),
        },
        headers=creator_headers,
    )
    assert create_res.status_code == 201
    task = create_res.json()
    task_id = task["id"]
    assert task["status"] == "posted"
    assert float(task["bounty_usdc"]) == 250.0

    # 2. Cannot claim a posted (unfunded) task
    bad_claim = client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": worker_account.address},
        headers=worker_headers,
    )
    assert bad_claim.status_code == 409

    # 3. Fund task → status = funded
    fund_res = client.patch(
        f"/tasks/{task_id}/fund",
        json={"wallet_address": creator_account.address, "fund_tx_hash": "0x" + "a" * 64},
        headers=creator_headers,
    )
    assert fund_res.status_code == 200
    assert fund_res.json()["status"] == "funded"

    # 4. Poster cannot claim own task
    bad_claim = client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": creator_account.address},
        headers=creator_headers,
    )
    assert bad_claim.status_code == 403

    # 5. Worker claims task → status = claimed
    claim_res = client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": worker_account.address},
        headers=worker_headers,
    )
    assert claim_res.status_code == 200
    assert claim_res.json()["status"] == "claimed"

    # 6. Worker submits non-GitHub proof → should fail
    bad_proof = client.patch(
        f"/tasks/{task_id}/submit",
        json={"wallet_address": worker_account.address, "proof": "https://example.com/not-github"},
        headers=worker_headers,
    )
    assert bad_proof.status_code == 400

    # 7. Worker submits valid GitHub proof → status = submitted
    good_proof = client.patch(
        f"/tasks/{task_id}/submit",
        json={
            "wallet_address": worker_account.address,
            "proof": "https://github.com/arc-network/mock-proof/pull/42",
        },
        headers=worker_headers,
    )
    assert good_proof.status_code == 200
    assert good_proof.json()["status"] == "submitted"

    # 8. Poster approves and pays → status = archived (auto-archived after payment)
    approve_res = client.patch(
        f"/tasks/{task_id}/approve",
        json={"wallet_address": creator_account.address, "tx_hash": "0x" + "b" * 64},
        headers=creator_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "archived"
    assert approve_res.json()["tx_hash"] == "0x" + "b" * 64

    # 9. Check escrow endpoint
    escrow_res = client.get(f"/tasks/{task_id}/escrow")
    assert escrow_res.status_code == 200
    assert escrow_res.json()["db_status"] == "archived"


# ═══════════════════════════════════════════════════════════════
#  Rejection & Resubmission
# ═══════════════════════════════════════════════════════════════

def test_rejection_and_resubmission(
    client: TestClient, creator_account, worker_account
):
    creator_token = get_auth_token(client, creator_account)
    worker_token = get_auth_token(client, worker_account)

    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    # Create, fund, claim, submit
    task = client.post(
        "/tasks/",
        json={
            "title": "Task With Rejection",
            "description": "Will be rejected then resubmitted",
            "bounty_usdc": 50.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": future_expiry(),
        },
        headers=creator_headers,
    ).json()
    task_id = task["id"]

    client.patch(
        f"/tasks/{task_id}/fund",
        json={"wallet_address": creator_account.address, "fund_tx_hash": "0x" + "c" * 64},
        headers=creator_headers,
    )
    client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": worker_account.address},
        headers=worker_headers,
    )
    client.patch(
        f"/tasks/{task_id}/submit",
        json={
            "wallet_address": worker_account.address,
            "proof": "https://github.com/arc-network/mock-proof/pull/1",
        },
        headers=worker_headers,
    )

    # 1. Reject with reason → status = rejected, worker stays assigned
    reject_res = client.patch(
        f"/tasks/{task_id}/reject",
        json={"wallet_address": creator_account.address, "reason": "Proof incomplete, needs more tests"},
        headers=creator_headers,
    )
    assert reject_res.status_code == 200
    rejected = reject_res.json()
    assert rejected["status"] == "rejected"
    assert rejected["worker_id"] is not None  # Worker stays assigned!
    assert rejected["proof"] is not None  # Old proof preserved
    assert rejected["rejection_reason"] == "Proof incomplete, needs more tests"

    # 2. Worker resubmits → status = submitted
    resubmit_res = client.patch(
        f"/tasks/{task_id}/submit",
        json={
            "wallet_address": worker_account.address,
            "proof": "https://github.com/arc-network/mock-proof/pull/2",
        },
        headers=worker_headers,
    )
    assert resubmit_res.status_code == 200
    resubmitted = resubmit_res.json()
    assert resubmitted["status"] == "submitted"
    assert resubmitted["rejection_reason"] is None  # Cleared on resubmission
    assert "pull/2" in resubmitted["proof"]

    # 3. Approve after resubmission → archived
    approve_res = client.patch(
        f"/tasks/{task_id}/approve",
        json={"wallet_address": creator_account.address, "tx_hash": "0x" + "d" * 64},
        headers=creator_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "archived"


# ═══════════════════════════════════════════════════════════════
#  Refund Expired Task (funded, no submissions)
# ═══════════════════════════════════════════════════════════════

def test_refund_expired_funded_task(
    client: TestClient, creator_account
):
    creator_token = get_auth_token(client, creator_account)
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    # Create task with past expiry
    task = client.post(
        "/tasks/",
        json={
            "title": "Expired Task",
            "description": "Should be refundable",
            "bounty_usdc": 100.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": past_expiry(),
        },
        headers=creator_headers,
    ).json()
    task_id = task["id"]
    assert task["status"] == "posted"

    # Fund it
    fund_res = client.patch(
        f"/tasks/{task_id}/fund",
        json={"wallet_address": creator_account.address, "fund_tx_hash": "0x" + "e" * 64},
        headers=creator_headers,
    )
    assert fund_res.status_code == 200
    assert fund_res.json()["status"] == "funded"

    # Refund expired → archived
    refund_res = client.patch(
        f"/tasks/{task_id}/refund",
        json={"wallet_address": creator_account.address, "refund_tx_hash": "0x" + "f" * 64},
        headers=creator_headers,
    )
    assert refund_res.status_code == 200
    refunded = refund_res.json()
    assert refunded["status"] == "archived"
    assert refunded["refund_tx_hash"] == "0x" + "f" * 64


# ═══════════════════════════════════════════════════════════════
#  Guard: Cannot refund non-expired or claimed/submitted tasks
# ═══════════════════════════════════════════════════════════════

def test_cannot_refund_non_expired_task(
    client: TestClient, creator_account
):
    creator_token = get_auth_token(client, creator_account)
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    task = client.post(
        "/tasks/",
        json={
            "title": "Active Task",
            "description": "Not expired",
            "bounty_usdc": 75.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": future_expiry(),
        },
        headers=creator_headers,
    ).json()
    task_id = task["id"]

    client.patch(
        f"/tasks/{task_id}/fund",
        json={"wallet_address": creator_account.address, "fund_tx_hash": "0x" + "1" * 64},
        headers=creator_headers,
    )

    # Try to refund before expiry → should fail
    refund_res = client.patch(
        f"/tasks/{task_id}/refund",
        json={"wallet_address": creator_account.address, "refund_tx_hash": "0x" + "2" * 64},
        headers=creator_headers,
    )
    assert refund_res.status_code == 409
    assert "not yet expired" in refund_res.json()["detail"]


def test_cannot_refund_claimed_task(
    client: TestClient, creator_account, worker_account
):
    creator_token = get_auth_token(client, creator_account)
    worker_token = get_auth_token(client, worker_account)

    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    task = client.post(
        "/tasks/",
        json={
            "title": "Claimed Task",
            "description": "Has a worker",
            "bounty_usdc": 60.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": future_expiry(),
        },
        headers=creator_headers,
    ).json()
    task_id = task["id"]

    client.patch(
        f"/tasks/{task_id}/fund",
        json={"wallet_address": creator_account.address, "fund_tx_hash": "0x" + "3" * 64},
        headers=creator_headers,
    )
    client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": worker_account.address},
        headers=worker_headers,
    )

    # Try to refund a claimed task → should fail (wrong status)
    refund_res = client.patch(
        f"/tasks/{task_id}/refund",
        json={"wallet_address": creator_account.address, "refund_tx_hash": "0x" + "4" * 64},
        headers=creator_headers,
    )
    assert refund_res.status_code == 409


# ═══════════════════════════════════════════════════════════════
#  Guard: No delete endpoint
# ═══════════════════════════════════════════════════════════════

def test_delete_endpoint_removed(
    client: TestClient, creator_account
):
    creator_token = get_auth_token(client, creator_account)
    creator_headers = {"Authorization": f"Bearer {creator_token}"}

    task = client.post(
        "/tasks/",
        json={
            "title": "Undeletable Task",
            "description": "Tasks are archived, never deleted",
            "bounty_usdc": 10.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": future_expiry(),
        },
        headers=creator_headers,
    ).json()

    # DELETE should return 405 Method Not Allowed
    del_res = client.delete(
        f"/tasks/{task['id']}?wallet_address={creator_account.address}",
        headers=creator_headers,
    )
    assert del_res.status_code == 405


# ═══════════════════════════════════════════════════════════════
#  Guard: Approve requires on-chain tx_hash
# ═══════════════════════════════════════════════════════════════

def test_approve_requires_tx_hash(
    client: TestClient, creator_account, worker_account
):
    creator_token = get_auth_token(client, creator_account)
    worker_token = get_auth_token(client, worker_account)

    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    task = client.post(
        "/tasks/",
        json={
            "title": "Requires TX Hash",
            "description": "Approval must include on-chain proof",
            "bounty_usdc": 30.0,
            "poster_wallet_address": creator_account.address,
            "expires_at": future_expiry(),
        },
        headers=creator_headers,
    ).json()
    task_id = task["id"]

    client.patch(
        f"/tasks/{task_id}/fund",
        json={"wallet_address": creator_account.address, "fund_tx_hash": "0x" + "5" * 64},
        headers=creator_headers,
    )
    client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": worker_account.address},
        headers=worker_headers,
    )
    client.patch(
        f"/tasks/{task_id}/submit",
        json={
            "wallet_address": worker_account.address,
            "proof": "https://github.com/arc-network/mock-proof/pull/99",
        },
        headers=worker_headers,
    )

    # Approve without tx_hash → 422 validation error
    approve_res = client.patch(
        f"/tasks/{task_id}/approve",
        json={"wallet_address": creator_account.address},
        headers=creator_headers,
    )
    assert approve_res.status_code == 422
