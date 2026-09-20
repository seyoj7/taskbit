---
name: taskbit
description: Project context and tech stack for the Taskbit project.
---
# Taskbit Skills

Project: Taskbit

I’m building Taskbit, an Arc-native Proof-of-Work marketplace for the Arc Microgrants program.

Core concept

Taskbit is a marketplace where people post small, verifiable tasks with a USDC bounty. Builders/workers complete the task and submit proof. Once the work is verified and approved, the escrowed USDC is released to the worker.

## Frontend

* Next.js
* React
* TypeScript
* Vanilla CSS
* Wallet connection
* USDC transaction handling
* Arc network integration

## Backend

* Python
* FastAPI
* Pydantic
* REST APIs
* MySQL
* SQLAlchemy
* Async programming

## Blockchain

* Solidity
* Arc
* EVM
* USDC
* Smart contract escrow
* Transaction verification
* Wallet signatures

## Verification

* GitHub API
* PR/commit verification
* Proof submission
* Task approval/rejection

## Development

* Git
* GitHub
* Environment variables
* API testing
* Contract testing

## Security

* Never expose private keys
* Validate all wallet addresses
* Validate bounty amounts
* Verify blockchain transactions on-chain
* Never release escrow without valid approval
* Keep secrets in `.env`


## Backend architecture

                 ┌──────────────┐
                 │   Next.js    │
                 └──────┬───────┘
                        │
                REST + wallet
                        │
                 ┌──────▼───────┐
                 │   FastAPI    │
                 └──────┬───────┘
                        │
              ┌─────────┴─────────┐
              │                   │
        ┌─────▼─────┐      ┌──────▼──────┐
        │   MySQL   │      │  GitHub API │
        └───────────┘      └─────────────┘
                                  │
                           proof verification
                                  │
                         ┌────────▼────────┐
                         │   Arc Network   │
                         │                 │
                         │ TaskEscrow.sol  │
                         │       +         │
                         │      USDC       │
                         └─────────────────┘