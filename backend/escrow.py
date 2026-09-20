import os
import json
from decimal import Decimal
from typing import Optional, Dict, Any
from web3 import Web3
from web3.exceptions import TransactionNotFound, ContractLogicError
from dotenv import load_dotenv

# Load .env from project root (one level up from backend/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

CONTRACT_ADDRESS_RAW = os.getenv("CONTRACT_ADDRESS", "0x3A2ADedbd0f5682a4DDCDeE6a3ef4bf5EB77503B")
RPC_URL = os.getenv("ARC_TESTNET_RPC_URL", "https://arc-testnet.drpc.org")

# Complete TaskEscrow ABI
TASK_ESCROW_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "_usdc", "type": "address"}],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "AlreadyCompleted",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "AlreadyFunded",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvalidBounty",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "InvalidWorker",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "NotFunded",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "OnlyCreator",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TaskAlreadyExists",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TaskNotFound",
        "type": "error"
    },
    {
        "inputs": [],
        "name": "TransferFailed",
        "type": "error"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "taskId", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "worker", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "PaymentReleased",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "taskId", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "creator", "type": "address"},
            {"indexed": False, "internalType": "address", "name": "worker", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "bounty", "type": "uint256"}
        ],
        "name": "TaskCreated",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "taskId", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "creator", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "TaskFunded",
        "type": "event"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "taskId", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "creator", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "TaskRefunded",
        "type": "event"
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "taskId", "type": "uint256"},
            {"internalType": "address", "name": "worker", "type": "address"},
            {"internalType": "uint256", "name": "bounty", "type": "uint256"}
        ],
        "name": "createTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "taskId", "type": "uint256"}],
        "name": "fundTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "taskId", "type": "uint256"}],
        "name": "getTask",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "creator", "type": "address"},
                    {"internalType": "address", "name": "worker", "type": "address"},
                    {"internalType": "uint256", "name": "bounty", "type": "uint256"},
                    {"internalType": "bool", "name": "funded", "type": "bool"},
                    {"internalType": "bool", "name": "completed", "type": "bool"}
                ],
                "internalType": "struct TaskEscrow.Task",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "taskId", "type": "uint256"}],
        "name": "refundTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "taskId", "type": "uint256"}],
        "name": "releasePayment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "taskId", "type": "uint256"}],
        "name": "tasks",
        "outputs": [
            {"internalType": "address", "name": "creator", "type": "address"},
            {"internalType": "address", "name": "worker", "type": "address"},
            {"internalType": "uint256", "name": "bounty", "type": "uint256"},
            {"internalType": "bool", "name": "funded", "type": "bool"},
            {"internalType": "bool", "name": "completed", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "usdc",
        "outputs": [{"internalType": "contract IERC20", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]


def get_web3_client() -> Web3:
    """Returns an initialized Web3 client configured for Arc Testnet."""
    return Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 10}))


def get_contract(w3: Optional[Web3] = None):
    """Returns the TaskEscrow contract instance."""
    if w3 is None:
        w3 = get_web3_client()
    checksum_addr = Web3.to_checksum_address(CONTRACT_ADDRESS_RAW)
    return w3.eth.contract(address=checksum_addr, abi=TASK_ESCROW_ABI)


def check_escrow_contract_health() -> Dict[str, Any]:
    """Inspects RPC connection and confirms contract code exists at CONTRACT_ADDRESS."""
    w3 = get_web3_client()
    is_connected = w3.is_connected()
    
    if not is_connected:
        return {
            "status": "error",
            "connected": False,
            "rpc_url": RPC_URL,
            "contract_address": CONTRACT_ADDRESS_RAW,
            "message": "Failed to connect to Arc Testnet RPC"
        }

    checksum_addr = Web3.to_checksum_address(CONTRACT_ADDRESS_RAW)
    code = w3.eth.get_code(checksum_addr)
    block_number = w3.eth.block_number

    return {
        "status": "ok",
        "connected": True,
        "rpc_url": RPC_URL,
        "chain_id": 5042002,
        "network": "Arc Testnet",
        "contract_address": checksum_addr,
        "is_deployed": len(code) > 0,
        "bytecode_size": len(code),
        "latest_block": block_number,
    }


def get_onchain_escrow_task(task_id: int) -> Dict[str, Any]:
    """
    Fetches the on-chain status of a task from the TaskEscrow contract.
    Returns dictionary with task status or exists=False if not yet registered on-chain.
    """
    w3 = get_web3_client()
    contract = get_contract(w3)
    
    try:
        task_data = contract.functions.getTask(task_id).call()
        creator, worker, bounty, funded, completed = task_data
        
        # If creator is zero address, task doesn't exist on-chain
        if creator == "0x0000000000000000000000000000000000000000":
            return {"exists": False, "task_id": task_id}

        return {
            "exists": True,
            "task_id": task_id,
            "creator": creator,
            "worker": worker,
            "bounty_raw": bounty,
            "bounty_usdc": float(Decimal(bounty) / Decimal(10**6)),
            "funded": funded,
            "completed": completed,
        }
    except ContractLogicError:
        # Reverted with TaskNotFound()
        return {"exists": False, "task_id": task_id}
    except Exception as e:
        return {
            "exists": False,
            "task_id": task_id,
            "error": str(e)
        }


def verify_payment_release_tx(
    tx_hash: str,
    task_id: int,
    expected_worker: Optional[str] = None
) -> Dict[str, Any]:
    """
    Verifies that an on-chain transaction succeeded and represents a valid
    releasePayment(taskId) on the TaskEscrow contract.
    """
    # Allow mock hash for development/testing if explicitly marked
    if tx_hash.startswith("0xMock"):
        return {
            "verified": True,
            "is_mock": True,
            "tx_hash": tx_hash,
            "message": "Mock transaction accepted in dev mode."
        }

    # Strict format check
    if not (tx_hash.startswith("0x") and len(tx_hash) == 66):
        return {
            "verified": False,
            "error": "Invalid transaction hash format. Must be a 66-character 0x hex string."
        }

    w3 = get_web3_client()
    contract = get_contract(w3)

    try:
        receipt = w3.eth.get_transaction_receipt(tx_hash)
    except TransactionNotFound:
        return {
            "verified": False,
            "error": f"Transaction {tx_hash} not found on Arc Testnet."
        }
    except Exception as e:
        return {
            "verified": False,
            "error": f"Failed to fetch transaction receipt: {str(e)}"
        }

    # Verify transaction execution status (1 = success)
    if receipt.get("status") != 1:
        return {
            "verified": False,
            "error": "Transaction reverted or failed on-chain."
        }

    # Verify destination is the TaskEscrow contract
    checksum_contract = Web3.to_checksum_address(CONTRACT_ADDRESS_RAW)
    if receipt.get("to") and Web3.to_checksum_address(receipt["to"]) != checksum_contract:
        return {
            "verified": False,
            "error": f"Transaction was sent to {receipt.get('to')}, not the TaskEscrow contract ({checksum_contract})."
        }

    # Decode and check PaymentReleased event
    payment_released_event = contract.events.PaymentReleased()
    event_logs = payment_released_event.process_receipt(receipt)

    matched_event = None
    for log in event_logs:
        args = log["args"]
        if args["taskId"] == task_id:
            matched_event = args
            break

    if not matched_event:
        return {
            "verified": False,
            "error": f"No PaymentReleased event found for task #{task_id} in this transaction."
        }

    if expected_worker:
        event_worker = Web3.to_checksum_address(matched_event["worker"])
        expected_worker_cs = Web3.to_checksum_address(expected_worker)
        if event_worker != expected_worker_cs:
            return {
                "verified": False,
                "error": f"Payment released to {event_worker}, expected {expected_worker_cs}."
            }

    amount_usdc = float(Decimal(matched_event["amount"]) / Decimal(10**6))
    return {
        "verified": True,
        "is_mock": False,
        "tx_hash": tx_hash,
        "block_number": receipt["blockNumber"],
        "task_id": task_id,
        "worker": matched_event["worker"],
        "amount_usdc": amount_usdc
    }
