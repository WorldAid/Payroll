# Stacks Chainhook Payroll

A reference implementation of verifiable, on-chain invoices and payments on Stacks. It ships a Clarity smart contract that records invoice lifecycle events and emits structured logs that are easy to index with Chainhooks. The project includes a Clarinet workspace and a Vitest setup for TypeScript-based tests.

## Repository Structure

- **`stacks-chainhook-payroll/`** – Clarinet project containing the Clarity contract, tests, and configs.
  - **`contracts/chainhook-contract.clar`** – Core contract implementing invoices and payments.
  - **`Clarinet.toml`** – Clarinet project configuration.
  - **`tests/`** – Vitest tests using `vitest-environment-clarinet`.
  - **`settings/Devnet.toml`** – Local devnet configuration (sample accounts, balances, ports, etc.).
  - **`settings/Mainnet.toml`** – Production configuration template (git ignored). Provide your own values locally.
  - **`package.json`** – NPM scripts and dependencies for testing.
  - **`tsconfig.json`** – TypeScript configuration for tests.
  - **`vitest.config.js`** – Vitest configuration using Clarinet environment.

## Smart Contract Overview

Contract: `contracts/chainhook-contract.clar`

- **Data model**
  - Map `invoices`: stores `{ id, creator, recipient, amount, status, created-height, paid-height?, payer? }`.
  - `invoice-counter`: auto-incrementing ID.
  - Status constants: `STATUS-UNPAID` (u0), `STATUS-PAID` (u1).

- **Read-only functions**
  - `get-invoice-count()` → `(ok uint)`
  - `get-invoice(invoice-id)` → `(ok { ... })` or `(err u404)`
  - `list-invoices(offset, limit)` → `(ok (list ... { ... }))` up to 50 items

- **Public functions**
  - `create-invoice(recipient, amount)`
    - Validates `amount > u0`.
    - Persists invoice with `STATUS-UNPAID`.
    - Emits `print` event: `{ event: "invoice-created", id, creator, recipient, amount, created-height }`.
  - `pay-invoice(invoice-id)`
    - Fails if already paid.
    - Calls `stx-transfer?` from `tx-sender` (payer) to invoice `recipient` for the stored `amount`.
    - Updates invoice: `STATUS-PAID`, sets `payer` and `paid-height`.
    - Emits `print` event: `{ event: "invoice-paid", id, payer, recipient, amount, paid-height }`.

- **Error codes**
  - `u404` not found, `u409` already paid, `u400` invalid amount, `u403` not recipient (reserved for potential checks).

- **Why Chainhooks-ready?**
  - Deterministic, structured `print` logs on create/pay enable off-chain processes (indexers, webhooks) to react to invoice lifecycle events reliably.

## Prerequisites

- Node.js 18+ and npm
- Docker (for running Clarinet devnet services)
- Clarinet CLI v3+

Install Clarinet: see official docs https://docs.hiro.so/clarinet

## Install and Build

```bash
cd Payroll/stacks-chainhook-payroll
npm install
```

## Run Tests

Vitest is configured with `vitest-environment-clarinet` to provide a simulated Stacks network (`simnet`).

- **Run once**
```bash
npm test
```

- **Run with coverage and costs**
```bash
npm run test:report
```

- **Watch mode (contracts and tests)**
```bash
npm run test:watch
```

The sample test at `tests/chainhook-contract.test.ts` verifies the simnet boots correctly. Add more tests to exercise `create-invoice`, `pay-invoice`, and read-only views.

## Clarinet Usage (Devnet)

- **Check project**
```bash
clarinet check
```

- **Start devnet** (services via Docker; uses `settings/Devnet.toml`)
```bash
clarinet devnet start
```

- **Open REPL / console**
```bash
clarinet console
```

Inside the console, you can call contract functions. Replace principals as needed.

### Example Calls (Console)

- **Create an invoice**
```lisp
;; Creator is tx-sender; recipient is a principal; amount is in micro-STX
(contract-call? .chainhook-contract create-invoice 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 u1000000)
```

- **Pay an invoice**
```lisp
;; Payer is tx-sender; transfers the stored amount to the invoice recipient
(contract-call? .chainhook-contract pay-invoice u1)
```

- **Read invoice data**
```lisp
;; Get invoice by id
(contract-call? .chainhook-contract get-invoice u1)

;; Number of invoices
(contract-call? .chainhook-contract get-invoice-count)

;; List with pagination (offset and limit)
(contract-call? .chainhook-contract list-invoices u1 u10)
```

Note: The `settings/Devnet.toml` includes pre-funded accounts like `wallet_1`, `wallet_2`, etc. Use their keys/addresses for local testing only. Do not reuse in production.

## Configuration

- **Devnet**: `settings/Devnet.toml`
  - Defines funded accounts, balances, and optional service ports.
- **Mainnet**: `settings/Mainnet.toml`
  - Git ignored in this repo. Create locally with your production configuration and secrets.
- **Project**: `Clarinet.toml`
  - Declares contract paths and Clarity settings. Remote data is disabled by default.

## Chainhooks Integration

Both `create-invoice` and `pay-invoice` emit structured `print` events. A Chainhook can subscribe to this contract and filter by:

- Contract calls: `contract_call.function_name == "create-invoice" | "pay-invoice"`
- Contract logs: parse the printed JSON payloads with `event == "invoice-created" | "invoice-paid"`

Use these events to trigger off-chain workflows (e.g., update an external database, send webhooks, or reconcile payments).

## Security and Notes

- The provided mnemonics in `settings/Devnet.toml` are for local development only.
- Always validate `recipient` principals and amounts on the client side.
- Consider adding access controls or recipient authorization checks if needed for your use case.
- For production, ensure your `settings/Mainnet.toml` and any private keys are stored securely and never committed.

## Scripts Summary

From `stacks-chainhook-payroll/package.json`:

- `npm test` – Run tests once.
- `npm run test:report` – Run tests with coverage and cost reporting.
- `npm run test:watch` – Watch tests and contracts for changes and re-run.

## License

SPDX-License-Identifier: MIT (see contract header). Add a repository-level LICENSE file if distributing.
