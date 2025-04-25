# Midnight Wallet MCP

This module provides a secure wallet service for Eliza AI agents to interact with the Midnight blockchain.

Each agent runs its own Wallet MCP instance, responsible for managing its private keys, syncing with the blockchain, and exposing safe MCP methods for blockchain operations.

---

## Features

- Wallet initialization and local persistence.
- Continuous blockchain syncing.
- MCP API methods for:
  - Checking wallet readiness.
  - Retrieving wallet address and balance.
  - Sending funds.
  - Validating transactions.
- Secure by design: no external access to private keys or seed management.

---

## MCP API Methods

| Method              | Description                      |
|---------------------|----------------------------------|
| `isReady()`         | Checks if the wallet is synced and ready. |
| `getAddress()`      | Returns the wallet's receiving address. |
| `getBalance()`      | Retrieves the available wallet balance. |
| `sendFunds(destinationAddress, amount)` | Sends funds to another address. |
| `validateTx(txHash)` | Validates the status of a transaction. |

For full method details, see [docs/wallet-mcp-api.md](./docs/wallet-mcp-api.md).

---

## Design Principles

- **No createWallet/exportSeed exposed externally** — wallet creation and restoration is internal only.
- **No blocking calls** — if the wallet is not ready, MCP immediately returns an error.
- **Persistence** — wallet state is saved locally for restart recovery.
- **Per-agent isolation** — each AI agent has its own separate Wallet MCP instance.

---

## Future Extensions

- Disclosed transactions (proof of sender, amount visibility).
- Advanced wallet features like multi-address support.

---

## License

Private project. All rights reserved.
