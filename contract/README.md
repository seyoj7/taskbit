# Taskbit Smart Contracts

Smart contracts and tests for the Taskbit decentralized escrow system on Arc.

## Overview

- **`contracts/TaskEscrow.sol`**: Manages the USDC escrow lifecycle:
  - `createTask(uint256 taskId, uint256 bounty)`
  - `fundTask(uint256 taskId)`
  - `assignWorker(uint256 taskId, address worker)`
  - `releasePayment(uint256 taskId)`
  - `refundTask(uint256 taskId)`
  - `getTask(uint256 taskId)`
- **`contracts/test/MockUSDC.sol`**: Mock 6-decimal ERC20 token replicating Circle USDC for local testing.

## Testing

Run all unit and integration tests:

```shell
npx hardhat test
```

### Foundry Solidity Unit Tests
Tests are located in `test/TaskEscrow.t.sol` using `forge-std`:
```shell
npx hardhat test solidity
```

### TypeScript / Ethers Integration Tests
Tests are located in `test/TaskEscrow.test.ts` using Mocha and ethers.js:
```shell
npx hardhat test mocha
```

## Deployment

Deploy to Arc Testnet using Hardhat Ignition:

```shell
npx hardhat ignition deploy --network arcTestnet ignition/modules/TaskEscrow.ts
```
