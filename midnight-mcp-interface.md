# Midnight MCP Interface Documentation

This document provides a detailed specification of the Model Context Protocol (MCP) interface for the Midnight network. This interface allows AI agents and other tools to interact with the Midnight blockchain through a standardized set of tools.

## Authentication

The MCP server uses an `AGENT_ID` for identifying the agent. This ID must be provided as an environment variable when running the server. The server manages wallets and storage on a per-agent basis.

## Tool Categories

The available tools are grouped into the following categories:

- [Wallet Tools](#wallet-tools)
- [Marketplace Tools](#marketplace-tools)

---

## Wallet Tools

These tools provide core wallet functionalities, such as checking balances, sending funds, and viewing transaction history.

### `walletStatus`

Get the current synchronization status of the wallet.

- **Description**: Checks if the wallet is synced with the Midnight blockchain.
- **Parameters**: None.
- **Output**:
    - `ready` (boolean): Whether the wallet is ready for operations.
    - `syncing` (boolean): Whether the wallet is currently syncing.
    - `syncProgress` (object): Sync progress information.
        - `synced` (boolean): True if fully synced.
        - `lag` (object): Lag information.
            - `applyGap` (string): Apply gap value.
            - `sourceGap` (string): Source gap value.
        - `percentage` (number): Sync percentage.
    - `address` (string): The wallet's address.
    - `balances` (object): Current wallet balances.
        - `balance` (string): Available spendable funds.
        - `pendingBalance` (string): Funds not yet available for spending.
    - `recovering` (boolean): Whether the wallet is in recovery mode.
    - `recoveryAttempts` (number): Number of recovery attempts made.
    - `maxRecoveryAttempts` (number): Maximum number of recovery attempts allowed.
    - `isFullySynced` (boolean): Whether the wallet is fully synced.

### `walletAddress`

Get the wallet's receiving address.

- **Description**: Retrieves the public address that can be used to receive funds.
- **Parameters**: None.
- **Output**:
    - `address` (string): The wallet's base address for receiving funds.

### `walletBalance`

Get the current balance of the wallet.

- **Description**: Fetches the current balance of the wallet from the Midnight network.
- **Parameters**: None.
- **Output**:
    - `balance` (string): The total spendable balance in the wallet (as a string in dust format).
    - `pendingBalance` (string): Coins that are pending and not yet available for spending (as a string in dust format).

### `sendFunds`

Send funds to another wallet address.

- **Description**: Creates and broadcasts a transaction to send a specified amount of funds to a destination address.
- **Parameters**:
    - `destinationAddress` (string, required): The recipient's wallet address.
    - `amount` (string, required): The amount of funds to send.
- **Output**:
    - `id` (string): UUID for the transaction record.
    - `state` (string): Current state of the transaction (e.g., "initiated").
    - `toAddress` (string): The recipient's wallet address.
    - `amount` (string): The amount sent (in dust format).
    - `createdAt` (number): Timestamp of when the transaction was created.

### `verifyTransaction`

Verify if a transaction has been received.

- **Description**: Verifies the status of a transaction using an identifier. This can be used to confirm if a payment has been received.
- **Parameters**:
    - `identifier` (string, required): The transaction identifier to verify.
- **Output**:
    - `exists` (boolean): Whether the transaction exists in the wallet.
    - `syncStatus` (object): Current sync status information.
        - `syncedIndices` (string): Indices that have been synced.
        - `lag` (object): Lag information.
            - `applyGap` (string): Apply gap value.
            - `sourceGap` (string): Source gap value.
        - `isFullySynced` (boolean): Whether the wallet is fully synced.
    - `transactionAmount` (string): The amount of the transaction (in dust format).

### `getTransactionStatus`

Get the status of a transaction by its ID.

- **Description**: Retrieves the current status of a specific transaction.
- **Parameters**:
    - `transactionId` (string, required): The ID of the transaction to check.
- **Output**:
    - `transaction` (object): The transaction record.
        - `id` (string): UUID of the transaction.
        - `state` (string): Current state ("initiated", "sent", "completed", or "failed").
        - `fromAddress` (string): Sender address.
        - `toAddress` (string): Recipient address.
        - `amount` (string): Amount in dust format.
        - `txIdentifier` (string, optional): Transaction identifier (once available).
        - `createdAt` (number): Timestamp of creation.
        - `updatedAt` (number): Timestamp of last update.
        - `errorMessage` (string, optional): Error message if transaction failed.
    - `blockchainStatus` (object, optional): Current blockchain status of the transaction.
        - `exists` (boolean): Whether the transaction exists on the blockchain.
        - `syncStatus` (object): Sync status information (same structure as in verifyTransaction).

### `getTransactions`

Get all transactions for the wallet.

- **Description**: Retrieves a list of all transactions associated with the wallet.
- **Parameters**: None.
- **Output**: Array of transaction records, where each record contains:
    - `id` (string): UUID of the transaction.
    - `state` (string): Current state ("initiated", "sent", "completed", or "failed").
    - `fromAddress` (string): Sender address.
    - `toAddress` (string): Recipient address.
    - `amount` (string): Amount in dust format.
    - `txIdentifier` (string, optional): Transaction identifier (once available).
    - `createdAt` (number): Timestamp of creation.
    - `updatedAt` (number): Timestamp of last update.
    - `errorMessage` (string, optional): Error message if transaction failed.

### `getWalletConfig`

Get the wallet's configuration.

- **Description**: Retrieves the configuration of the wallet, including the connected NODE and Indexer URLs.
- **Parameters**: None.
- **Output**:
    - `indexer` (string): The URL of the Indexer service.
    - `indexerWS` (string): The WebSocket URL of the Indexer service.
    - `node` (string): The URL of the Midnight node.
    - `proofServer` (string): The URL of the proof server.
    - `logDir` (string, optional): Directory for log files.
    - `networkId` (string, optional): The network identifier.
    - `useExternalProofServer` (boolean, optional): Flag indicating if an external proof server is used.

---

## Marketplace Tools

These tools are used for interacting with a marketplace built on the Midnight network.

### `registerInMarketplace`

Register a user in the marketplace.

- **Description**: Registers a new user in the marketplace contract.
- **Parameters**:
    - `userId` (string, required): The unique identifier for the user.
    - `userData` (object, required): An object containing user data for registration.

### `verifyUserInMarketplace`

Verify a user in the marketplace.

- **Description**: Verifies a user's status or details in the marketplace.
- **Parameters**:
    - `userId` (string, required): The unique identifier for cinematographer to be verified.
    - `verificationData` (object, required): An object containing data required for verification.

---

## Midnight AI Social Simulation Enhancements

To support a rich, AI-driven social simulation like "AI Town" on the Midnight network, where AI agents control characters within a Minecraft world, the following MCP interface enhancements are proposed. These tools will enable agents to perform on-chain operations that underpin the society and economy of the simulation.

### Identity and Reputation Tools

- **`createCharacterIdentity`**
    - **Description**: Creates a new on-chain identity for the agent's character, represented as an NFT.
    - **Parameters**:
        - `name` (string, required): The name of the character.
        - `metadata` (object, optional): Initial character attributes to be stored on-chain.
- **`getCharacterReputation`**
    - **Description**: Retrieves the reputation score of a character from the reputation smart contract.
    - **Parameters**:
        - `characterId` (string, required): The on-chain identifier of the character.

### On-Chain Asset Management Tools

- **`mintItem`**
    - **Description**: Mints a new in-game item as an NFT and assigns it to the character's wallet. This is used for creating unique items through crafting.
    - **Parameters**:
        - `itemName` (string, required): The name of the item.
        - `attributes` (object, required): The properties of the item.
- **`transferItem`**
    - **Description**: Transfers an item (NFT) from the agent's character's wallet to another character.
    - **Parameters**:
        - `itemId` (string, required): The unique identifier of the item NFT.
        - `recipientId` (string, required): The on-chain identifier of the recipient character.
- **`getInventory`**
    - **Description**: Retrieves a list of all on-chain assets (NFTs) owned by the character.
    - **Parameters**: None.

### Economic Contract Tools

- **`createJobContract`**
    - **Description**: Creates an on-chain smart contract for a job, locking the payment in escrow until the job is completed.
    - **Parameters**:
        - `title` (string, required): The title of the job.
        - `description` (string, required): A description of the job.
        - `paymentAmount` (string, required): The amount of funds for payment.
- **`acceptJobContract`**
    - **Description**: Allows a character to accept a job, entering them into the smart contract.
    - **Parameters**:
        - `jobId` (string, required): The on-chain identifier of the job contract.
- **`completeJobContract`**
    - **Description**: Used by the job creator to confirm the completion of a job, which releases the payment from escrow to the worker.
    - **Parameters**:
        - `jobId` (string, required): The on-chain identifier of the job contract.
- **`listItemOnMarketplace`**
    - **Description**: Lists an item (NFT) for sale on a decentralized marketplace smart contract.
    - **Parameters**:
        - `itemId` (string, required): The ID of the item NFT to sell.
        - `price` (string, required): The asking price for the item.
- **`purchaseItemFromMarketplace`**
    - **Description**: Purchases an item listed on the marketplace.
    - **Parameters**:
        - `listingId` (string, required): The ID of the marketplace listing.

### Social Contract Tools

- **`formPartnership`**
    - **Description**: Creates an on-chain smart contract that formally establishes a partnership between two or more characters, potentially including rules for profit sharing.
    - **Parameters**:
        - `partnerIds` (array of strings, required): A list of the on-chain identifiers of the characters forming the partnership.
        - `terms` (object, required): The terms of the partnership agreement.

### Decentralized Identity (DID) Tools

These tools integrate with Hyperledger Identus to provide verifiable decentralized identities for all agents in the simulation (Phase II).

- **`createDID`**
    - **Description**: Creates a decentralized identifier (DID) for a character, establishing their verifiable on-chain identity.
    - **Parameters**:
        - `characterId` (string, required): The character's unique identifier.
        - `didMetadata` (object, optional): Additional metadata for the DID document.
- **`resolveDID`**
    - **Description**: Resolves a DID to retrieve the associated public information and DID document.
    - **Parameters**:
        - `did` (string, required): The decentralized identifier to resolve.
- **`issueCredential`**
    - **Description**: Issues a verifiable credential to a character (e.g., business license, employment certificate, certifications).
    - **Parameters**:
        - `recipientDID` (string, required): The DID of the credential recipient.
        - `credentialType` (string, required): The type of credential being issued.
        - `claims` (object, required): The claims/attributes included in the credential.
        - `expirationDate` (string, optional): Expiration date for the credential.
- **`verifyCredential`**
    - **Description**: Verifies the authenticity and validity of a presented credential.
    - **Parameters**:
        - `credential` (object, required): The credential object to verify.
- **`revokeCredential`**
    - **Description**: Revokes a previously issued credential, marking it as no longer valid.
    - **Parameters**:
        - `credentialId` (string, required): The unique identifier of the credential to revoke.
- **`presentCredential`**
    - **Description**: Presents one or more credentials for verification with selective disclosure of specific attributes.
    - **Parameters**:
        - `credentialIds` (array of strings, required): List of credential IDs to present.
        - `disclosedAttributes` (array of strings, optional): Specific attributes to disclose (supports zero-knowledge proofs).

### Privacy & Selective Disclosure Tools

These tools leverage Midnight's privacy features to enable default-private transactions with selective disclosure capabilities (Phase II).

- **`requestDataDisclosure`**
    - **Description**: Requests access to specific private transaction data from another character.
    - **Parameters**:
        - `targetCharacterId` (string, required): The character from whom data is being requested.
        - `dataType` (string, required): The type of data being requested (e.g., "transactions", "credentials", "business_records").
        - `justification` (string, required): Reason for the data request.
        - `timeframe` (object, optional): Time range for the requested data.
- **`grantDisclosurePermission`**
    - **Description**: Grants temporary access to specific private data in response to a disclosure request.
    - **Parameters**:
        - `requestId` (string, required): The ID of the disclosure request being approved.
        - `scope` (object, required): Defines exactly what data is being disclosed and any conditions.
        - `expirationTime` (string, optional): When the disclosure permission expires.
- **`revokeDisclosurePermission`**
    - **Description**: Revokes previously granted access to private data.
    - **Parameters**:
        - `permissionId` (string, required): The ID of the permission to revoke.
- **`getDisclosureRequests`**
    - **Description**: Retrieves all pending and historical disclosure requests for the character.
    - **Parameters**:
        - `status` (string, optional): Filter by status ("pending", "approved", "denied", "revoked").
- **`getAuditLog`**
    - **Description**: Retrieves an immutable audit trail of all data access and disclosure events for compliance purposes.
    - **Parameters**:
        - `startDate` (string, optional): Start date for the audit log query.
        - `endDate` (string, optional): End date for the audit log query.
- **`setPrivacyPolicy`**
    - **Description**: Configures default privacy settings for the character's transactions and data.
    - **Parameters**:
        - `defaultPrivacyLevel` (string, required): Default privacy level ("private", "semi-private", "public").
        - `autoDisclosureRules` (object, optional): Rules for automatic disclosure under specific conditions.

### Business Entity Management

These tools enable characters to establish and manage business entities within the simulation economy.

- **`registerBusiness`**
    - **Description**: Registers a new business entity on-chain with its associated metadata.
    - **Parameters**:
        - `businessName` (string, required): The name of the business.
        - `businessType` (string, required): The type/category of business (e.g., "retail", "service", "manufacturing").
        - `ownerIds` (array of strings, required): List of character IDs who own the business.
        - `metadata` (object, optional): Additional business information (location, description, etc.).
- **`getBusinessProfile`**
    - **Description**: Retrieves the public profile and information about a registered business.
    - **Parameters**:
        - `businessId` (string, required): The unique identifier of the business.
- **`updateBusinessProfile`**
    - **Description**: Updates the business profile information.
    - **Parameters**:
        - `businessId` (string, required): The unique identifier of the business.
        - `updates` (object, required): The fields to update and their new values.
- **`issueBusinessLicense`**
    - **Description**: Issues an official business operating license (typically by governance or authorized entities).
    - **Parameters**:
        - `businessId` (string, required): The business receiving the license.
        - `licenseType` (string, required): The type of license being issued.
        - `validUntil` (string, required): Expiration date of the license.
- **`verifyBusinessLicense`**
    - **Description**: Verifies if a business has valid operating licenses.
    - **Parameters**:
        - `businessId` (string, required): The business to verify.
        - `licenseType` (string, optional): Specific license type to check.
- **`reportBusinessIncome`**
    - **Description**: Submits financial reports for business compliance and record-keeping.
    - **Parameters**:
        - `businessId` (string, required): The business submitting the report.
        - `reportingPeriod` (object, required): The time period covered by the report.
        - `financialData` (object, required): The financial data being reported (can use selective disclosure).

### Enhanced Reputation System

Extends the basic reputation tools to support dynamic reputation tracking and dispute resolution.

- **`updateReputation`**
    - **Description**: Updates a character's reputation score based on completed interactions or events.
    - **Parameters**:
        - `characterId` (string, required): The character whose reputation is being updated.
        - `change` (number, required): The amount to adjust reputation (positive or negative).
        - `reason` (string, required): The reason for the reputation change.
        - `evidenceId` (string, optional): Reference to on-chain evidence supporting the change.
- **`recordInteraction`**
    - **Description**: Records a social or economic interaction between characters that may affect reputation.
    - **Parameters**:
        - `participants` (array of strings, required): Character IDs involved in the interaction.
        - `interactionType` (string, required): Type of interaction (e.g., "trade", "service", "collaboration").
        - `outcome` (string, required): Result of the interaction ("positive", "negative", "neutral").
        - `details` (object, optional): Additional details about the interaction.
- **`getReputationHistory`**
    - **Description**: Retrieves the complete history of reputation changes for a character.
    - **Parameters**:
        - `characterId` (string, required): The character to query.
        - `startDate` (string, optional): Start date for historical query.
        - `endDate` (string, optional): End date for historical query.
- **`disputeReputationRecord`**
    - **Description**: Allows a character to challenge or dispute a reputation entry.
    - **Parameters**:
        - `reputationRecordId` (string, required): The ID of the reputation record being disputed.
        - `disputeReason` (string, required): Explanation for the dispute.
        - `evidence` (object, optional): Supporting evidence for the dispute.

### Property & Real Estate Tools

These tools manage property ownership and real estate transactions within the simulation world.

- **`registerProperty`**
    - **Description**: Registers property ownership on-chain, creating a deed NFT.
    - **Parameters**:
        - `propertyName` (string, required): Name or identifier for the property.
        - `location` (object, required): In-game coordinates or location identifier.
        - `propertyType` (string, required): Type of property (e.g., "residential", "commercial", "industrial").
        - `metadata` (object, optional): Additional property details (size, features, etc.).
- **`transferProperty`**
    - **Description**: Transfers property ownership from one character to another.
    - **Parameters**:
        - `propertyId` (string, required): The unique identifier of the property.
        - `newOwnerId` (string, required): The character ID of the new owner.
        - `salePrice` (string, optional): The agreed-upon sale price.
- **`createLeaseAgreement`**
    - **Description**: Creates a rental/lease smart contract for a property.
    - **Parameters**:
        - `propertyId` (string, required): The property being leased.
        - `tenantId` (string, required): The character renting the property.
        - `rentAmount` (string, required): The periodic rent amount.
        - `paymentFrequency` (string, required): How often rent is due (e.g., "daily", "weekly").
        - `duration` (string, required): Length of the lease.
- **`endLeaseAgreement`**
    - **Description**: Terminates an existing lease agreement.
    - **Parameters**:
        - `leaseId` (string, required): The unique identifier of the lease to terminate.
        - `reason` (string, optional): Reason for termination.
- **`getPropertyOwnership`**
    - **Description**: Queries property ownership records from the on-chain registry.
    - **Parameters**:
        - `propertyId` (string, optional): Specific property to query. If omitted, returns all properties owned by the caller.
        - `ownerId` (string, optional): Query properties owned by a specific character.

### Organization Management

Tools for creating and managing complex organizational structures beyond simple partnerships.

- **`createOrganization`**
    - **Description**: Forms an organization such as guilds, clubs, syndicates, or agencies with on-chain governance.
    - **Parameters**:
        - `organizationName` (string, required): The name of the organization.
        - `organizationType` (string, required): Type of organization (e.g., "guild", "club", "cooperative").
        - `foundingMembers` (array of strings, required): Character IDs of founding members.
        - `governanceRules` (object, required): Initial governance and decision-making rules.
- **`addOrganizationMember`**
    - **Description**: Adds a new member to an organization with a specific role.
    - **Parameters**:
        - `organizationId` (string, required): The organization's unique identifier.
        - `memberId` (string, required): The character ID to add.
        - `role` (string, required): The role/position within the organization.
- **`removeOrganizationMember`**
    - **Description**: Removes a member from an organization.
    - **Parameters**:
        - `organizationId` (string, required): The organization's unique identifier.
        - `memberId` (string, required): The character ID to remove.
- **`getOrganizationMembers`**
    - **Description**: Lists all members of an organization and their roles.
    - **Parameters**:
        - `organizationId` (string, required): The organization to query.
- **`setOrganizationRules`**
    - **Description**: Updates the governance rules and policies of an organization.
    - **Parameters**:
        - `organizationId` (string, required): The organization's unique identifier.
        - `newRules` (object, required): The updated governance rules.
- **`voteOnOrganizationProposal`**
    - **Description**: Casts a vote on an organizational decision or proposal.
    - **Parameters**:
        - `organizationId` (string, required): The organization's unique identifier.
        - `proposalId` (string, required): The proposal being voted on.
        - `vote` (string, required): The vote choice (e.g., "yes", "no", "abstain").

### Governance & Voting Tools

These tools enable city-wide or community-level governance and democratic decision-making.

- **`createProposal`**
    - **Description**: Creates a governance proposal for community voting.
    - **Parameters**:
        - `title` (string, required): The title of the proposal.
        - `description` (string, required): Detailed description of the proposal.
        - `proposalType` (string, required): Type of proposal (e.g., "policy", "funding", "rule_change").
        - `votingPeriod` (string, required): Duration for which voting is open.
        - `executionActions` (array of objects, optional): Smart contract actions to execute if approved.
- **`voteOnProposal`**
    - **Description**: Casts a vote on an active governance proposal.
    - **Parameters**:
        - `proposalId` (string, required): The proposal being voted on.
        - `vote` (string, required): The vote choice (e.g., "yes", "no", "abstain").
        - `votingPower` (number, optional): Amount of voting power to use (if applicable).
- **`executeProposal`**
    - **Description**: Executes the actions of an approved proposal after the voting period ends.
    - **Parameters**:
        - `proposalId` (string, required): The proposal to execute.
- **`delegateVotingPower`**
    - **Description**: Delegates voting power to another character for governance decisions.
    - **Parameters**:
        - `delegateId` (string, required): The character ID to delegate voting power to.
        - `amount` (number, optional): Amount of voting power to delegate (if not all).
        - `scope` (string, optional): Scope of delegation (e.g., "all", "specific_proposals").

---

## Additional Considerations

### Batch Operations

For improved efficiency when handling multiple operations, especially important for scaling to 1,000+ agents:

- **`batchSendFunds`**
    - **Description**: Sends funds to multiple recipients in a single transaction to reduce gas costs and improve throughput.
    - **Parameters**:
        - `recipients` (array of objects, required): List of {address, amount} pairs for the batch transfer.
- **`batchMintItems`**
    - **Description**: Mints multiple items (NFTs) in one transaction for efficiency.
    - **Parameters**:
        - `items` (array of objects, required): List of items to mint, each with name and attributes.

### Query & Analytics Functions

To support the Social Simulation Analytics Dashboard and provide observable metrics:

- **`getMarketplaceStats`**
    - **Description**: Retrieves aggregated statistics about marketplace activity (total volume, active listings, transaction counts, etc.).
    - **Parameters**:
        - `timeframe` (string, optional): Time period for statistics (e.g., "24h", "7d", "30d").
- **`getEconomicMetrics`**
    - **Description**: Returns economic health indicators for the simulation (total wealth, wealth distribution, transaction velocity, etc.).
    - **Parameters**:
        - `metricTypes` (array of strings, optional): Specific metrics to retrieve.
- **`getSocialNetworkGraph`**
    - **Description**: Retrieves relationship and interaction data between characters for network visualization.
    - **Parameters**:
        - `characterId` (string, optional): Focus on specific character's network. If omitted, returns global network.
        - `depth` (number, optional): How many degrees of separation to include.
        - `interactionTypes` (array of strings, optional): Filter by specific types of relationships.

### Time-based Contract Operations

For enabling scheduled and time-locked operations in the simulation:

- **`createTimeLock`**
    - **Description**: Locks funds or contract actions until a specific time or condition is met.
    - **Parameters**:
        - `asset` (object, required): The asset or action to time-lock.
        - `unlockTime` (string, required): When the time lock expires.
        - `beneficiary` (string, optional): Who can claim after unlock.
- **`scheduleTransaction`**
    - **Description**: Schedules a transaction or contract call to execute at a future time.
    - **Parameters**:
        - `transactionData` (object, required): The transaction details to execute.
        - `executionTime` (string, required): When to execute the transaction.
        - `conditions` (object, optional): Additional conditions that must be met for execution.
