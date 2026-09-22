import os
import tempfile
import pytest
from decimal import Decimal
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

from db import Base, get_db
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
    # Attempting to create a task without signing in / without Bearer token
    res = client.post(
        "/tasks/",
        json={
            "title": "Unauthenticated Task",
            "description": "Should fail",
            "bounty_usdc": 100.0,
            "poster_wallet_address": creator_account.address,
        },
    )
    assert res.status_code == 401
    assert "Missing or invalid Bearer authentication token" in res.json()["detail"]


def test_task_lifecycle_create_claim_submit_approve(
    client: TestClient, creator_account, worker_account
):
    creator_token = get_auth_token(client, creator_account)
    worker_token = get_auth_token(client, worker_account)

    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    # 1. Create Task
    create_res = client.post(
        "/tasks/",
        json={
            "title": "Build Arc Bridge",
            "description": "Implement verified smart contract bridge",
            "bounty_usdc": 250.0,
            "poster_wallet_address": creator_account.address,
        },
        headers=creator_headers,
    )
    assert create_res.status_code == 201
    task = create_res.json()
    task_id = task["id"]
    assert task["status"] == "open"
    assert float(task["bounty_usdc"]) == 250.0

    # 2. Poster cannot claim own task
    bad_claim = client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": creator_account.address},
        headers=creator_headers,
    )
    assert bad_claim.status_code == 403

    # 3. Worker claims task
    claim_res = client.patch(
        f"/tasks/{task_id}/claim",
        json={"wallet_address": worker_account.address},
        headers=worker_headers,
    )
    assert claim_res.status_code == 200
    assert claim_res.json()["status"] == "claimed"

    # 4. Worker submits non-GitHub proof -> should fail
    bad_proof = client.patch(
        f"/tasks/{task_id}/submit",
        json={"wallet_address": worker_account.address, "proof": "https://example.com/not-github"},
        headers=worker_headers,
    )
    assert bad_proof.status_code == 400

    # 5. Worker submits valid GitHub proof
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

    # 6. Poster approves task
    approve_res = client.patch(
        f"/tasks/{task_id}/approve",
        json={"wallet_address": creator_account.address, "tx_hash": "0xMockApprovalTx12345"},
        headers=creator_headers,
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"
    assert approve_res.json()["tx_hash"] == "0xMockApprovalTx12345"

    # 7. Check escrow endpoint
    escrow_res = client.get(f"/tasks/{task_id}/escrow")
    assert escrow_res.status_code == 200
    assert escrow_res.json()["db_status"] == "approved"


def test_task_rejection_and_deletion(client: TestClient, creator_account, worker_account):
    creator_token = get_auth_token(client, creator_account)
    worker_token = get_auth_token(client, worker_account)

    creator_headers = {"Authorization": f"Bearer {creator_token}"}
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    # Create task
    task = client.post(
        "/tasks/",
        json={
            "title": "Task To Reject",
            "description": "Details",
            "bounty_usdc": 50.0,
            "poster_wallet_address": creator_account.address,
        },
        headers=creator_headers,
    ).json()
    task_id = task["id"]

    # Claim & submit
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

    # Reject
    reject_res = client.patch(
        f"/tasks/{task_id}/reject",
        json={"wallet_address": creator_account.address, "reason": "Proof incomplete"},
        headers=creator_headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "rejected"
    assert reject_res.json()["worker_id"] is None

    # Delete
    del_res = client.delete(
        f"/tasks/{task_id}?wallet_address={creator_account.address}",
        headers=creator_headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["id"] == task_id
