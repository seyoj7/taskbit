// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title TaskEscrow
 * @notice Escrows USDC bounties for Taskbit tasks on Arc.
 *
 * Lifecycle:
 *   1. Creator registers task: createTask(taskId, bounty) [or with initial worker]
 *   2. Creator funds escrow:  fundTask(taskId)
 *   3. Creator assigns worker: assignWorker(taskId, worker)
 *   4. Work approved:         releasePayment(taskId) → worker receives USDC
 *      OR
 *      Task refunded:         refundTask(taskId)     → creator receives USDC
 */
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TaskEscrow {
    // ── Types ────────────────────────────────────────────────

    struct Task {
        address creator;
        address worker;
        uint256 bounty;
        uint256 expiryTimestamp;
        bool funded;
        bool completed;
        bool workSubmitted;
    }

    // ── State ────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public owner;
    mapping(uint256 => Task) public tasks;

    // ── Events ───────────────────────────────────────────────

    event TaskCreated(uint256 indexed taskId, address indexed creator, address worker, uint256 bounty, uint256 expiryTimestamp);
    event TaskFunded(uint256 indexed taskId, address indexed creator, uint256 amount);
    event WorkerAssigned(uint256 indexed taskId, address indexed worker);
    event WorkSubmitted(uint256 indexed taskId, address indexed worker);
    event PaymentReleased(uint256 indexed taskId, address indexed worker, uint256 amount);
    event TaskRefunded(uint256 indexed taskId, address indexed creator, uint256 amount);

    // ── Errors ───────────────────────────────────────────────

    error OnlyCreator();
    error TaskAlreadyExists();
    error TaskNotFound();
    error AlreadyFunded();
    error NotFunded();
    error AlreadyCompleted();
    error InvalidBounty();
    error InvalidWorker();
    error WorkerNotAssigned();
    error TransferFailed();
    error TaskExpired();
    error TaskNotExpired();
    error WorkAlreadySubmitted();

    // ── Modifiers ────────────────────────────────────────────

    modifier onlyCreator(uint256 taskId) {
        if (tasks[taskId].creator == address(0)) revert TaskNotFound();
        if (tasks[taskId].creator != msg.sender) revert OnlyCreator();
        _;
    }

    // ── Constructor ──────────────────────────────────────────

    /**
     * @param _usdc Address of the USDC token contract on Arc.
     */
    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    // ── Core Functions ───────────────────────────────────────

    /**
     * @notice Register a new task without an initial worker.
     * @param taskId  Off-chain task ID (from database).
     * @param bounty  Bounty amount in USDC (6-decimal token units).
     * @param expiryTimestamp Timestamp after which the task expires and can be refunded.
     */
    function createTask(uint256 taskId, uint256 bounty, uint256 expiryTimestamp) external {
        _createTask(taskId, address(0), bounty, expiryTimestamp);
    }

    /**
     * @notice Register a new task with an initial worker (overloaded).
     * @param taskId  Off-chain task ID.
     * @param worker  Wallet address of the assigned worker (can be address(0)).
     * @param bounty  Bounty amount in USDC (6-decimal token units).
     * @param expiryTimestamp Timestamp after which the task expires and can be refunded.
     */
    function createTask(uint256 taskId, address worker, uint256 bounty, uint256 expiryTimestamp) external {
        if (worker == msg.sender) revert InvalidWorker();
        _createTask(taskId, worker, bounty, expiryTimestamp);
    }

    function _createTask(uint256 taskId, address worker, uint256 bounty, uint256 expiryTimestamp) internal {
        if (tasks[taskId].creator != address(0)) revert TaskAlreadyExists();
        if (bounty == 0) revert InvalidBounty();

        tasks[taskId] = Task({
            creator: msg.sender,
            worker: worker,
            bounty: bounty,
            expiryTimestamp: expiryTimestamp,
            funded: true,
            completed: false,
            workSubmitted: false
        });

        emit TaskCreated(taskId, msg.sender, worker, bounty, expiryTimestamp);

        bool success = usdc.transferFrom(msg.sender, address(this), bounty);
        if (!success) revert TransferFailed();

        emit TaskFunded(taskId, msg.sender, bounty);
    }

    /**
     * @notice Assign or update the assigned worker for a task.
     * @param taskId  The task to assign the worker to.
     * @param worker  The worker's wallet address.
     */
    function assignWorker(uint256 taskId, address worker) external onlyCreator(taskId) {
        Task storage task = tasks[taskId];
        if (task.completed) revert AlreadyCompleted();
        if (worker == address(0) || worker == msg.sender) revert InvalidWorker();

        task.worker = worker;

        emit WorkerAssigned(taskId, worker);
    }

    /**
     * @notice Worker submits work on-chain to prevent refund.
     * @param taskId  The task to submit work for.
     */
    function submitWork(uint256 taskId) external {
        Task storage task = tasks[taskId];
        if (task.creator == address(0)) revert TaskNotFound();
        if (task.completed) revert AlreadyCompleted();
        if (task.workSubmitted) revert WorkAlreadySubmitted();
        if (block.timestamp > task.expiryTimestamp) revert TaskExpired();

        if (task.worker == address(0)) {
            task.worker = msg.sender;
            emit WorkerAssigned(taskId, msg.sender);
        } else if (task.worker != msg.sender) {
            revert InvalidWorker();
        }

        task.workSubmitted = true;
        emit WorkSubmitted(taskId, msg.sender);
    }

    /**
     * @notice Release escrowed USDC to the worker (task approved).
     * @param taskId  The task whose bounty should be released.
     */
    function releasePayment(uint256 taskId) external onlyCreator(taskId) {
        Task storage task = tasks[taskId];
        if (!task.funded) revert NotFunded();
        if (task.completed) revert AlreadyCompleted();
        if (task.worker == address(0)) revert WorkerNotAssigned();

        task.completed = true;

        bool success = usdc.transfer(task.worker, task.bounty);
        if (!success) revert TransferFailed();

        emit PaymentReleased(taskId, task.worker, task.bounty);
    }

    /**
     * @notice Refund escrowed USDC back to the creator (task cancelled/rejected).
     * @param taskId  The task whose bounty should be refunded.
     */
    function refundTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        if (task.creator == address(0)) revert TaskNotFound();
        if (!task.funded) revert NotFunded();
        if (task.completed) revert AlreadyCompleted();
        if (block.timestamp < task.expiryTimestamp) revert TaskNotExpired();
        if (task.workSubmitted) revert WorkAlreadySubmitted();

        task.completed = true;

        bool success = usdc.transfer(task.creator, task.bounty);
        if (!success) revert TransferFailed();

        emit TaskRefunded(taskId, task.creator, task.bounty);
    }

    /**
     * @notice View a task's details.
     * @param taskId  The task to query.
     * @return The Task struct.
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        if (tasks[taskId].creator == address(0)) revert TaskNotFound();
        return tasks[taskId];
    }
}
