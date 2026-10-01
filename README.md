# Taskbit

**Arc-Native Proof-of-Work Marketplace with USDC Smart Contract Escrow**

Taskbit is a decentralized micro-bounty marketplace built for the Arc network. Project creators post small, verifiable tasks with USDC bounties held in a trustless smart contract escrow. Multiple builders can submit verifiable GitHub proofs (Pull Requests or Commits) for each task. The poster reviews all submissions, selects the best one, and approves it — releasing the escrowed USDC directly to the chosen worker on-chain. If no workers submit by the deadline, the poster can reclaim their funds.

---

## 🏛 Architecture Overview

```text
               ┌──────────────────────────────────────┐
               │         Next.js Frontend             │
               │  (React 19 + TypeScript + Ethers v6) │
               └──────────────────┬───────────────────┘
                                  │
                 REST API + Bearer JWT + Web3 Provider
                                  │
               ┌──────────────────▼───────────────────┐
               │           FastAPI Backend            │
               │   (Python + SQLAlchemy + Web3.py)    │
               └─────────┬───────────────────┬────────┘
                         │                   │
               ┌─────────▼─────────┐   ┌─────▼──────────────┐
               │  SQLite / MySQL   │   │  GitHub REST API   │
               │     Database      │   │  Proof Verification│
               └───────────────────┘   └─────────────┬──────┘
                                                     │
                                            Verified Proof
                                                     │
                                       ┌─────────────▼──────┐
                                       │   Arc Testnet / EVM│
                                       │   TaskEscrow.sol   │
                                       │     + USDC Token   │
                                       └────────────────────┘
```

---

## ⚡ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Vanilla CSS, Ethers.js v6 |
| **Backend** | Python, FastAPI, SQLAlchemy, Pydantic v2, Web3.py, PyJWT |
| **Blockchain** | Solidity 0.8.27, Hardhat, Arc Testnet (EVM, Chain ID 5042002) |
| **Database** | SQLite (development) / MySQL (production) |
| **Authentication** | EIP-191 wallet signatures + JWT bearer tokens |
| **Verification** | GitHub REST API (PR & commit validation) |

---

## 🔄 Escrow Lifecycle

The `TaskEscrow` smart contract enforces a secure escrow lifecycle where task registration and USDC funding happen atomically in a single transaction:

```text
POSTED → FUNDED → (workers submit PRs) → APPROVED → PAID → ARCHIVED
                                               ↑
             Poster selects best worker ───────┘

FUNDED → (no submissions + expired) → REFUNDED → ARCHIVED
```

1. **Create & Fund Task**:
   - Creator registers a task and locks the USDC bounty in the escrow contract in one atomic transaction. The creator must approve the USDC transfer first:
     ```solidity
     usdc.approve(address(taskEscrow), bounty);
     taskEscrow.createTask(taskId, bounty, expiryTimestamp);
     ```

2. **Workers Submit Proofs**:
   - Multiple workers can submit GitHub PR proofs for the same task before the deadline. Each worker also submits work on-chain to prevent premature refunds:
     ```solidity
     taskEscrow.submitWork(taskId);
     ```

3. **Poster Reviews & Selects**:
   - The poster reviews all submissions and selects the best one. The chosen worker is assigned on-chain:
     ```solidity
     taskEscrow.assignWorker(taskId, selectedWorkerAddress);
     ```

4. **Release or Refund**:
   - **Work Approved**: The poster approves the selected submission and releases the bounty to that worker:
     ```solidity
     taskEscrow.releasePayment(taskId);
     ```
   - **Task Expired & Refunded**: If the task expires with no submissions (or all submissions are rejected), the creator can refund the escrowed USDC:
     ```solidity
     taskEscrow.refundTask(taskId);
     ```

---

## 🔐 Cryptographic Wallet Authentication

Taskbit uses **EIP-191 challenge-response personal signatures** to prevent wallet spoofing:

1. The frontend requests a cryptographic challenge: `POST /users/auth/challenge`
2. The user signs the challenge message in their wallet (`personal_sign`).
3. The backend verifies the signature on-chain with `w3.eth.account.recover_message` and issues a secure signed JWT access token (`POST /users/auth/verify`).
4. Protected API mutations (submitting proofs, approving/rejecting submissions, refunding tasks) require a valid `Bearer <token>` matching the caller's address.

---

## 🔎 Verifiable GitHub Proofs

When builders submit proof for a completed task:
- URL must originate from `https://github.com/`.
- Validates Pull Requests (`/owner/repo/pull/<number>`) and Commits (`/owner/repo/commit/<sha>`).
- Queries the GitHub API with optional `GITHUB_TOKEN` support to bypass rate limits, with graceful web-liveness fallback.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **Python**: v3.11 or higher
- **Web3 Wallet**: MetaMask or any browser EVM wallet connected to Arc Testnet.

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your variables:

```env
# Arc Blockchain
ARC_TESTNET_RPC_URL=https://arc-testnet.drpc.org
USDC_ADDRESS=0x3600000000000000000000000000000000000000
CONTRACT_ADDRESS=0x9dC7c747B74dB5885AFC1798CAA1675F1510c4Df

# Optional GitHub API Token (prevents rate limits)
GITHUB_TOKEN=

# Auth Secret
JWT_SECRET=your-random-jwt-secret-key

# Database
DATABASE_URL=sqlite:///../database/taskbit.db
```

### 3. Installation & Local Development

Install dependencies for the root, frontend, and contracts:

```bash
# Install frontend & root dependencies
npm install

# Install contract dependencies
cd contract && npm install && cd ..

# Install Python backend dependencies
cd backend && pip install -r requirements.txt && cd ..
```

Start both the frontend and backend concurrently:

```bash
npm run dev
```

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend API Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 4. Deploy Smart Contract

You can deploy the `TaskEscrow` contract in two ways:

**Browser UI (recommended for quick setup):**
Navigate to [http://localhost:3000/deploy-escrow](http://localhost:3000/deploy-escrow) and deploy directly from your browser wallet.

**Hardhat CLI:**
```bash
cd contract
npx hardhat ignition deploy ignition/modules/TaskEscrow.ts --network arcTestnet
```

After deployment, update `CONTRACT_ADDRESS` in your `.env` file with the new address.

---

## 🧪 Testing

### Smart Contract Tests
Run the Hardhat test suite:

```bash
cd contract
npx hardhat test
```

### Backend API Tests
Run the pytest test suite covering cryptographic auth, task lifecycles, and proof validation:

```bash
cd backend
python -m pytest tests/
```

### Frontend Typecheck
Verify TypeScript types and component interfaces:

```bash
npx tsc --noEmit
```

---

## 📝 License

MIT
