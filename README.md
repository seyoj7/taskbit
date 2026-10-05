# Taskbit

**Arc-Native Proof-of-Work Marketplace with USDC Smart Contract Escrow**

Taskbit is a decentralized micro-bounty marketplace built for the Arc network. Project creators post small, verifiable tasks with USDC bounties held in a trustless smart contract escrow. Multiple builders can submit verifiable GitHub proofs (Pull Requests or Commits) for each task. The poster reviews all submissions, selects the best one, and approves it — releasing the escrowed USDC directly to the chosen worker on-chain. If no workers submit by the deadline, the poster can reclaim their funds. Workers can leave reputation reviews on posters, building an on-chain trust layer for the marketplace.

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
               │    PostgreSQL /   │   │  GitHub REST API   │
               │   MySQL / SQLite  │   │  Proof Verification│
               └───────────────────┘   └─────────────┬──────┘
                                                     │
                                            Verified Proof
                                                     │
                                       ┌─────────────▼──────┐
                                       │   Arc Mainnet / EVM│
                                       │   TaskEscrow.sol   │
                                       │     + USDC Token   │
                                       └────────────────────┘
```

---

## 📁 Project Structure

```text
taskbit/
├── app/                          # Next.js frontend
│   ├── components/               # Reusable UI components
│   │   ├── Navbar.tsx            # Wallet-connected navigation bar
│   │   ├── Footer.tsx            # Site footer
│   │   ├── TaskCard.tsx          # Task card component
│   │   ├── WalletProvider.tsx    # Ethers.js wallet context provider
│   │   ├── api.ts                # Backend API client (all REST calls)
│   │   ├── contracts/            # Contract ABIs & helpers
│   │   └── ConfirmModal/         # Reusable confirmation dialog
│   ├── marketplace/              # Marketplace dashboard page
│   │   └── [id]/                 # Individual task detail page
│   ├── post-task/                # Create & fund a new task
│   ├── deploy-escrow/            # Browser-based contract deployment
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout with global providers
│   └── globals.css               # Global design tokens & styles
│
├── server/                       # FastAPI server
│   ├── main.py                   # All API routes & business logic
│   ├── database.py               # SQLAlchemy models & migrations
│   ├── escrow.py                 # On-chain escrow verification (Web3.py)
│   ├── requirements.txt          # Python dependencies
│   └── tests/                    # Pytest test suite
│       ├── test_api.py           # API integration tests
│       └── seed.py               # Database seeding script
│
├── contract/                     # Smart contract (Hardhat)
│   ├── contracts/
│   │   └── TaskEscrow.sol        # Solidity escrow contract
│   ├── ignition/                 # Hardhat Ignition deployment modules
│   ├── hardhat.config.ts         # Hardhat configuration (Arc Mainnet)
│   └── package.json              # Contract dependencies
│
├── package.json                  # Root package.json (concurrently runs frontend + server)
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript configuration
└── .env.example                  # Environment variable template
```

---

## ⚡ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Vanilla CSS, Ethers.js v6 |
| **Backend** | Python, FastAPI, SQLAlchemy, Pydantic v2, Web3.py, PyJWT |
| **Blockchain** | Solidity 0.8.27, Hardhat, Arc Mainnet (EVM, Chain ID 5042) |
| **Database** | PostgreSQL (production) / MySQL / SQLite (development) |
| **Authentication** | EIP-191 wallet signatures + JWT bearer tokens (7-day expiry) |
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
   - Creator registers a task (optionally with an initial worker) and locks the USDC bounty in the escrow contract in one atomic transaction. The creator must approve the USDC transfer first:
     ```solidity
     usdc.approve(address(taskEscrow), bounty);
     taskEscrow.createTask(taskId, bounty, expiryTimestamp); // Or with initial worker
     ```

2. **Worker Submits Work**:
   - A worker can submit work on-chain before the deadline. If no worker is currently assigned to the task, this action automatically assigns them:
     ```solidity
     taskEscrow.submitWork(taskId);
     ```

3. **Poster Assigns Worker**:
   - The poster can explicitly assign or update the chosen worker on-chain at any time before completion:
     ```solidity
     taskEscrow.assignWorker(taskId, selectedWorkerAddress);
     ```

4. **Release or Refund**:
   - **Work Approved**: The poster approves the selected submission and releases the bounty to the assigned worker:
     ```solidity
     taskEscrow.releasePayment(taskId);
     ```
   - **Task Expired & Refunded**: Once the task expires, the creator can refund the escrowed USDC (allowed regardless of whether work was submitted, allowing posters to reclaim funds after rejecting submissions):
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

## ⭐ Poster Reputation System

Taskbit includes a **poster reputation system** that lets workers rate task posters after a submission outcome, building a transparent trust layer for the marketplace.

### How It Works

After a worker's submission is **rejected** or **selected** (approved), they can leave a one-time review on the poster consisting of:
- **Vote**: `+1` (upvote) or `-1` (downvote)
- **Comment**: A required text review (5–500 characters)

Each poster's **reputation score** is computed in real time as:

```
Score = Total Upvotes − Total Downvotes
```

### Rules & Constraints

| Rule | Detail |
|---|---|
| **Who can review** | Only the worker who owns the submission |
| **When** | After the submission status is `rejected` or `selected` |
| **One review per submission** | Enforced by a unique constraint — duplicate attempts return `409` |
| **Auto-rejections excluded** | Submissions auto-rejected with "Another submission was selected" cannot be reviewed |
| **Score calculation** | Computed at read time (not stored), always up-to-date |

### Data Model

```text
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │       │  Submission  │       │ PosterReview │
│  (Worker)    │──────▶│              │──────▶│              │
│              │       │  task_id     │       │  vote (+1/-1)│
│              │       │  worker_id   │       │  comment     │
│              │       │  status      │       │  reviewer_id │
└──────────────┘       └──────────────┘       │  poster_id   │
                                              └──────────────┘
```

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/submissions/{id}/review` | Submit a review for a poster (auth required) |
| `GET` | `/submissions/{id}/review` | Get the review for a specific submission |
| `GET` | `/users/wallet/{address}/reviews` | Get a poster's reputation score + all reviews |

### Example: Fetch a Poster's Reputation

```bash
curl http://127.0.0.1:8000/users/wallet/0x1234.../reviews
```

Response:
```json
{
  "poster_wallet_address": "0x1234...",
  "poster_id": 1,
  "upvotes": 12,
  "downvotes": 2,
  "score": 10,
  "reviews": [
    {
      "id": 1,
      "submission_id": 5,
      "reviewer_id": 3,
      "reviewer_wallet_address": "0xabcd...",
      "poster_id": 1,
      "vote": 1,
      "comment": "Great poster, clear requirements and fast approval!",
      "created_at": "2026-10-01T12:00:00Z"
    }
  ]
}
```

---

## 📡 API Reference

All protected endpoints require a `Bearer <JWT>` token obtained via wallet signature authentication.

### Health & Status

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | No | API health check |
| `GET` | `/escrow/health` | No | Arc Mainnet RPC + contract deployment status |

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/users/auth/challenge` | No | Request a cryptographic sign-in challenge |
| `POST` | `/users/auth/verify` | No | Verify wallet signature and receive JWT |
| `POST` | `/users/auth/wallet` | No | Direct wallet connect (dev/lookup) |

### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/users/` | No | List all registered users |
| `GET` | `/users/{id}` | No | Get user by ID |
| `GET` | `/users/wallet/{address}` | No | Get user by wallet address |

### Tasks

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/tasks/` | ✅ | Create a new task |
| `GET` | `/tasks/` | No | List tasks (filter by `?task_status=`) |
| `GET` | `/tasks/{id}` | No | Get task details |
| `GET` | `/tasks/{id}/escrow` | No | Fetch real-time on-chain escrow status |

### Task Lifecycle

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `PATCH` | `/tasks/{id}/fund` | ✅ | Record on-chain funding (`posted → funded`) |
| `PATCH` | `/tasks/{id}/submit` | ✅ | Submit proof of work (GitHub PR/commit) |
| `PATCH` | `/tasks/{id}/approve` | ✅ | Approve a submission + release payment on-chain |
| `PATCH` | `/tasks/{id}/reject` | ✅ | Reject a specific submission |
| `PATCH` | `/tasks/{id}/refund` | ✅ | Refund expired task on-chain |

### Submissions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/tasks/{id}/submissions` | No | List all submissions for a task |

### Poster Reputation

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/submissions/{id}/review` | ✅ | Submit a poster review (vote + comment) |
| `GET` | `/submissions/{id}/review` | No | Get review for a specific submission |
| `GET` | `/users/wallet/{address}/reviews` | No | Get poster's reputation score + all reviews |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20 or higher
- **Python**: v3.11 or higher
- **Web3 Wallet**: MetaMask or any browser EVM wallet connected to Arc Mainnet.

### 2. Environment Configuration

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your variables:

```env
# Arc Blockchain
ARC_RPC_URL=https://rpc.mainnet.arc.io
USDC_ADDRESS=0x3600000000000000000000000000000000000000
CONTRACT_ADDRESS=0x1A02aF9cA91bAfAFCC0987cf9e89d3c210766915

# Deployer Private Key (for Hardhat CLI deployment only — never commit!)
PRIVATE_KEY=

# Authentication
JWT_SECRET=<generate-with: python -c "import secrets; print(secrets.token_hex(32))">

# Optional GitHub API Token (prevents rate limits)
GITHUB_TOKEN=

# Database (PostgreSQL, MySQL, or SQLite)
DATABASE_URL=postgresql://user:password@host:5432/taskbit
```

Set these variables in Vercel for each deployment environment. `CONTRACT_ADDRESS` is also exposed to the frontend by `next.config.ts`; do not add a separate `NEXT_PUBLIC_CONTRACT_ADDRESS` variable. Use a PostgreSQL service with SSL settings included in its connection URL when required by the provider.

### 3. Installation & Local Development

Install dependencies for the root, frontend, and contracts:

```bash
# Install frontend & root dependencies
npm install

# Install contract dependencies
cd contract && npm install && cd ..

# Install Python backend dependencies
cd server && pip install -r requirements.txt && cd ..
```

Before using the production API after this schema change, initialize the PostgreSQL schema using the production `DATABASE_URL`. Repeat this step after future schema changes:

```bash
cd server
python -c "from database import init_db; init_db()"
cd ..
```

The API does not create or migrate tables automatically when it starts. The auth challenge records are stored in PostgreSQL so sign-in works across separate Vercel function instances.

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
npx hardhat ignition deploy ignition/modules/TaskEscrow.ts --network arcMainnet
```

After deployment, update `CONTRACT_ADDRESS` in your `.env` file with the new address.

---

## 📝 License

MIT
