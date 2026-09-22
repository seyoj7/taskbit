# Taskbit

**Arc-Native Proof-of-Work Marketplace with USDC Smart Contract Escrow**

Taskbit is a decentralized micro-bounty marketplace built for the Arc network. Project creators post small, verifiable tasks with USDC bounties held in a trustless smart contract escrow. Builders claim tasks, complete the work, and submit verifiable GitHub proofs (Pull Requests or Commits). Once work is verified and approved, escrowed USDC is released directly to the worker on-chain.

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

## 🔄 Escrow Lifecycle

The `TaskEscrow` smart contract enforces a secure, 4-step escrow lifecycle:

1. **Create Task**:
   - Creator initiates a task with a unique task ID and bounty amount:
     ```solidity
     taskEscrow.createTask(taskId, bounty);
     ```
2. **Fund Escrow**:
   - Creator approves USDC transfer and locks the bounty in the escrow contract:
     ```solidity
     usdc.approve(address(taskEscrow), bounty);
     taskEscrow.fundTask(taskId);
     ```
3. **Assign Worker**:
   - When a worker claims the task or is approved by the creator, the creator assigns their wallet address on-chain:
     ```solidity
     taskEscrow.assignWorker(taskId, workerAddress);
     ```
4. **Release or Refund**:
   - **Work Approved**: Once the worker submits proof (verified via GitHub API), the creator approves and releases the bounty to the worker:
     ```solidity
     taskEscrow.releasePayment(taskId);
     ```
   - **Task Refunded**: If work is rejected, cancelled, or expired, the creator can refund the escrowed USDC back to their wallet:
     ```solidity
     taskEscrow.refundTask(taskId);
     ```

---

## 🔐 Cryptographic Wallet Authentication

Taskbit uses **EIP-191 challenge-response personal signatures** to prevent wallet spoofing:

1. The frontend requests a cryptographic challenge: `POST /users/auth/challenge`
2. The user signs the challenge message in their wallet (`personal_sign`).
3. The backend verifies the signature on-chain with `w3.eth.account.recover_message` and issues a secure signed JWT access token (`POST /users/auth/verify`).
4. Protected API mutations (claiming tasks, submitting proofs, approving work, deleting tasks) require a valid `Bearer <token>` matching the caller's address.

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
CONTRACT_ADDRESS=0x7Dc4d05938F68F815BE3283870125B3A13bbDC7d

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

---

## 🧪 Testing

### Smart Contract Tests (Solidity & TypeScript)
Run the full 14-test smart contract test suite (Foundry unit tests + Mocha integration tests):

```bash
cd contract
npx hardhat test
```

Or selectively:
```bash
npx hardhat test solidity
npx hardhat test mocha
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

## 🤖 Continuous Integration

GitHub Actions workflow is configured in `.github/workflows/test.yml` to automatically execute:
- Smart contract compilation and tests (`npx hardhat test`)
- Backend test suite with pytest (`pytest tests/`)
- TypeScript typecheck (`npx tsc --noEmit`)
