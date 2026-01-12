# UltraLife Protocol: LLM-Chain Interaction Implementation

## The Real Questions

1. **How does the LLM read chain state?**
2. **How does the LLM build transactions from reference scripts?**
3. **What additional security layers exist?**
4. **What do SPOs actually interact with when they test?**

---

## Current Gap: We Have Contracts, Not Infrastructure

**What we have:**
- 25 Aiken validators (smart contract logic)
- Type definitions
- Documentation

**What we need to build/integrate:**
- Chain state indexer (how LLM reads)
- Transaction builder service (how LLM constructs)
- Reference script deployment
- Wallet connection layer

---

## Architecture: How It Actually Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER's LLM                                      │
│                    (Claude, GPT, their own instance)                        │
│                                                                              │
│   User: "I want to create a pNFT"                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ API Call (MCP or REST)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ULTRALIFE SERVICE LAYER                                  │
│                                                                              │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│   │  State Indexer  │  │  TX Builder     │  │  Reference      │            │
│   │                 │  │                 │  │  Scripts        │            │
│   │  • Blockfrost   │  │  • Lucid/Blaze  │  │                 │            │
│   │  • Ogmios       │  │  • Mesh         │  │  • pnft.ak      │            │
│   │  • Koios        │  │  • CardanoJS    │  │  • token.ak     │            │
│   │  • Custom       │  │                 │  │  • etc.         │            │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Unsigned TX (CBOR)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER's WALLET                                        │
│                    (Browser extension, hardware)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Signed TX
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CARDANO NETWORK                                      │
│                    (Reference scripts on-chain)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component 1: Chain State Reading

### Option A: Blockfrost API
```typescript
// LLM service uses Blockfrost to read chain state
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';

const api = new BlockFrostAPI({ projectId: 'your_key' });

// Read pNFT datum
async function getPnftDatum(pnftAssetId: string): Promise<PnftDatum> {
  // Find UTxO containing this pNFT
  const utxos = await api.addressesUtxosAsset(pnftContractAddress, pnftAssetId);
  const utxo = utxos[0];
  
  // Decode datum
  const datum = await api.scriptsDatumCbor(utxo.data_hash);
  return decodePnftDatum(datum.cbor);
}

// Read bioregion index
async function getBioregionIndex(bioregionId: string): Promise<BioregionIndex> {
  const utxos = await api.addressesUtxos(bioregionContractAddress);
  // Find the one with matching bioregion_id in datum
  // ...
}
```

### Option B: Ogmios + Custom Indexer
```typescript
// More control, self-hosted
import { createInteractionContext } from '@cardano-ogmios/client';

const context = await createInteractionContext(
  (err) => console.error(err),
  (code, reason) => console.log(code, reason),
  { connection: { host: 'localhost', port: 1337 } }
);

// Query UTxOs by address
const utxos = await context.query('utxo', { addresses: [contractAddress] });
```

### Option C: Koios API
```typescript
// Community-run, free tier available
const response = await fetch(
  `https://api.koios.rest/api/v1/address_utxos?_address=${contractAddress}`
);
const utxos = await response.json();
```

### What We Need to Build: UltraLife Indexer

```typescript
// Custom indexer that understands UltraLife datum types
class UltraLifeIndexer {
  private blockfrost: BlockFrostAPI;
  private contractAddresses: ContractAddresses;
  
  // Cached state for fast queries
  private pnftCache: Map<string, PnftDatum> = new Map();
  private bioregionCache: Map<string, BioregionIndex> = new Map();
  private offeringCache: Map<string, Offering> = new Map();
  
  // Subscribe to chain updates
  async startSync() {
    // Listen for new blocks
    // Update caches when UltraLife UTxOs change
  }
  
  // Query methods the LLM calls
  async getPnft(pnftId: string): Promise<PnftDatum | null> { }
  async getBioregion(bioregionId: string): Promise<BioregionIndex | null> { }
  async getOfferings(filters: OfferingFilters): Promise<Offering[]> { }
  async getNeeds(filters: NeedFilters): Promise<Need[]> { }
  async getAgreements(pnftId: string): Promise<Agreement[]> { }
  
  // Impact queries
  async getConsumerImpacts(pnftId: string): Promise<CompoundBalance[]> { }
  async getAssetImpactHistory(assetId: string): Promise<ActivityRecord[]> { }
}
```

---

## Component 2: Transaction Building

### Using Lucid (or Blaze/Mesh)

```typescript
import { Lucid, Blockfrost, Data, fromText } from 'lucid-cardano';

class UltraLifeTxBuilder {
  private lucid: Lucid;
  private referenceScripts: Map<string, OutRef>;  // On-chain reference scripts
  
  async initialize() {
    this.lucid = await Lucid.new(
      new Blockfrost('https://cardano-preprod.blockfrost.io/api', 'your_key'),
      'Preprod'
    );
    
    // Load reference script locations
    this.referenceScripts = await this.loadReferenceScripts();
  }
  
  // Build pNFT minting transaction
  async buildMintPnft(
    userAddress: string,
    dnaHash: string,
    verificationProof: VerificationProof,
  ): Promise<UnsignedTx> {
    
    // Get reference script for pNFT minting
    const pnftMintRef = this.referenceScripts.get('pnft_mint');
    
    // Build the datum
    const pnftDatum = Data.to({
      pnft_id: fromText(generatePnftId()),
      owner: userAddress,
      level: { Standard: {} },
      dna_hash: dnaHash,
      bioregion: null,
      created_at: Date.now(),
      consumer_impacts: null,
      care_credits: 0n,
    }, PnftDatumSchema);
    
    // Build the redeemer
    const redeemer = Data.to({
      MintPnft: {
        dna_hash: dnaHash,
        verification_proof: verificationProof,
      }
    }, PnftRedeemerSchema);
    
    // Construct transaction
    const tx = await this.lucid
      .newTx()
      .mintAssets(
        { [pnftPolicyId + pnftAssetName]: 1n },
        redeemer
      )
      .readFrom([pnftMintRef])  // Reference script (no need to include full script)
      .payToContract(
        pnftContractAddress,
        { inline: pnftDatum },
        { [pnftPolicyId + pnftAssetName]: 1n }
      )
      // Bootstrap grant: 50 tokens
      .payToAddress(userAddress, { [tokenPolicyId]: 50_000_000n })
      .complete();
    
    return tx;
  }
  
  // Build offering creation transaction
  async buildCreateOffering(
    offererPnft: string,
    offering: OfferingParams,
  ): Promise<UnsignedTx> {
    
    // Get reference script
    const marketplaceRef = this.referenceScripts.get('marketplace');
    
    // Build offering datum
    const offeringDatum = Data.to({
      offering_id: generateOfferingId(),
      offerer: offererPnft,
      category: offering.category,
      what: offering.what,
      location: offering.location,
      availability: offering.availability,
      terms: offering.terms,
      expected_compounds: offering.expectedCompounds,
      evidence: offering.evidence,
      status: { Active: {} },
      created_at: Date.now(),
    }, OfferingDatumSchema);
    
    const redeemer = Data.to({
      CreateListing: {
        listing_type: offering.listingType,
        price: offering.price,
        tags: offering.tags,
        expires_at: offering.expiresAt,
      }
    }, MarketplaceRedeemerSchema);
    
    const tx = await this.lucid
      .newTx()
      .readFrom([marketplaceRef])
      .payToContract(
        marketplaceAddress,
        { inline: offeringDatum },
        { lovelace: 2_000_000n }  // Min UTxO
      )
      .complete();
    
    return tx;
  }
  
  // Build token transfer (payment)
  async buildPayment(
    senderPnft: string,
    recipientPnft: string,
    amount: bigint,
    transactionType: TransactionType,
    compoundFlows: CompoundFlow[],
  ): Promise<UnsignedTx> {
    
    // Get sender's UTxOs with tokens
    const senderUtxos = await this.lucid.utxosAt(senderAddress);
    
    // Get reference scripts
    const tokenRef = this.referenceScripts.get('token');
    const recordsRef = this.referenceScripts.get('records');
    
    // Build transaction record datum
    const recordDatum = Data.to({
      record_id: generateRecordId(),
      sender: senderPnft,
      recipient: recipientPnft,
      amount: amount,
      transaction_type: transactionType,
      compound_flows: compoundFlows,
      timestamp: Date.now(),
    }, TransactionRecordSchema);
    
    const tx = await this.lucid
      .newTx()
      .readFrom([tokenRef, recordsRef])
      // Transfer tokens
      .payToAddress(recipientAddress, { [tokenPolicyId]: amount })
      // Create transaction record
      .payToContract(
        recordsAddress,
        { inline: recordDatum },
        { lovelace: 2_000_000n }
      )
      .complete();
    
    return tx;
  }
}
```

---

## Component 3: Reference Scripts

### Deployment Strategy

```typescript
// Deploy all validators as reference scripts
async function deployReferenceScripts(lucid: Lucid): Promise<Map<string, OutRef>> {
  const scripts = new Map<string, OutRef>();
  
  // Compile Aiken to Plutus
  const compiledScripts = await compileAikenProject('./contracts');
  
  for (const [name, script] of Object.entries(compiledScripts)) {
    // Create UTxO with script
    const tx = await lucid
      .newTx()
      .payToAddressWithData(
        referenceScriptAddress,
        { scriptRef: script },
        { lovelace: 20_000_000n }  // Enough for script storage
      )
      .complete();
    
    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();
    
    // Store reference
    scripts.set(name, { txHash, outputIndex: 0 });
    
    console.log(`Deployed ${name}: ${txHash}#0`);
  }
  
  return scripts;
}
```

### Reference Script Registry (On-Chain)

```aiken
// Registry of all UltraLife reference scripts
pub type ScriptRegistry {
  pnft_mint: OutputReference,
  pnft_spend: OutputReference,
  token: OutputReference,
  marketplace: OutputReference,
  work_auction: OutputReference,
  records: OutputReference,
  bioregion: OutputReference,
  stake_pool: OutputReference,
  governance: OutputReference,
  ubi: OutputReference,
  // ... all validators
  
  /// Admin who can update (initially, then governance)
  admin: VerificationKeyHash,
}
```

---

## Component 4: Additional Security Layers

### Transaction Tokens (Optional but Recommended)

```aiken
// A "session token" that proves the transaction was built by authorized service
pub type SessionToken {
  session_id: ByteArray,
  user_pnft: AssetName,
  expires_at: Int,
  allowed_actions: List<ActionType>,
  service_signature: ByteArray,
}

// Validator can optionally require session token
validator token_with_session(config: TokenConfig) {
  spend(datum, redeemer, ctx) {
    // Standard validation...
    
    // OPTIONAL: If session token present, validate it
    when find_session_token(ctx.transaction.reference_inputs) is {
      Some(session) -> {
        // Verify session is valid and covers this action
        expect verify_session(session, ctx)
        True
      }
      None -> {
        // Still allow without session (direct wallet use)
        True
      }
    }
  }
}
```

**Why optional?** Users should be able to build transactions manually without going through any service. The session token is for rate limiting / abuse prevention, not security.

### Rate Limiting at Service Layer

```typescript
// Prevent abuse of the transaction building service
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  async checkLimit(pnftId: string, action: string): Promise<boolean> {
    const key = `${pnftId}:${action}`;
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const maxRequests = 10;
    
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(t => t > now - windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false; // Rate limited
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }
}
```

### Audit Log

```typescript
// Every transaction request is logged
interface AuditEntry {
  timestamp: number;
  pnftId: string;
  action: string;
  params: any;
  txHash?: string;
  status: 'built' | 'signed' | 'submitted' | 'confirmed' | 'failed';
  ipAddress?: string; // Optional, for abuse detection
}

class AuditLog {
  async log(entry: AuditEntry): Promise<void> {
    // Store in database
    // This is NOT on-chain (would be expensive)
    // But provides accountability for the service
  }
}
```

---

## Component 5: LLM Integration (MCP)

### Model Context Protocol Server

```typescript
// MCP server that LLMs connect to
import { Server } from '@modelcontextprotocol/sdk/server';

const server = new Server({
  name: 'ultralife-protocol',
  version: '1.0.0',
});

// Tools the LLM can call
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_pnft',
      description: 'Get pNFT details for a user',
      inputSchema: {
        type: 'object',
        properties: {
          pnft_id: { type: 'string' }
        }
      }
    },
    {
      name: 'list_offerings',
      description: 'List available offerings in a bioregion',
      inputSchema: {
        type: 'object',
        properties: {
          bioregion: { type: 'string' },
          category: { type: 'string', optional: true },
          max_results: { type: 'number', default: 10 }
        }
      }
    },
    {
      name: 'build_mint_pnft',
      description: 'Build transaction to create a pNFT (requires DNA verification)',
      inputSchema: {
        type: 'object',
        properties: {
          user_address: { type: 'string' },
          dna_hash: { type: 'string' },
          verification_proof: { type: 'object' }
        }
      }
    },
    {
      name: 'build_create_offering',
      description: 'Build transaction to create a marketplace offering',
      inputSchema: {
        type: 'object',
        properties: {
          offerer_pnft: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          price: { type: 'number' },
          // ...
        }
      }
    },
    {
      name: 'build_payment',
      description: 'Build transaction to pay another pNFT',
      inputSchema: {
        type: 'object',
        properties: {
          sender_pnft: { type: 'string' },
          recipient_pnft: { type: 'string' },
          amount: { type: 'number' },
          purpose: { type: 'string' }
        }
      }
    },
    // ... more tools
  ]
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'get_pnft':
      const pnft = await indexer.getPnft(args.pnft_id);
      return { content: [{ type: 'text', text: JSON.stringify(pnft) }] };
    
    case 'build_mint_pnft':
      const tx = await txBuilder.buildMintPnft(
        args.user_address,
        args.dna_hash,
        args.verification_proof
      );
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({
            unsigned_tx: tx.toString(),
            tx_hash: tx.toHash(),
            summary: summarizeTransaction(tx)
          })
        }]
      };
    
    // ... handle other tools
  }
});
```

---

## What SPOs Will Actually Do

### Step 1: Connect Their LLM

```
User (in their LLM): "Connect to UltraLife protocol"

LLM: I'll connect to the UltraLife MCP server.
[Calls MCP connect]

Connected to UltraLife Protocol (Preprod testnet)
- 847 active pNFTs
- 23 bioregions registered
- 156 active offerings

What would you like to do?
```

### Step 2: Create pNFT (Simulated DNA for Testnet)

```
User: "I want to create a pNFT"

LLM: On testnet, I'll create a pNFT with simulated DNA verification.
[Calls build_mint_pnft with test data]

Built transaction:
- Action: Mint pNFT
- Your pNFT ID: pnft_abc123...
- Bootstrap grant: 50 tokens
- Fee: ~0.3 ADA

Please sign in your wallet to complete.
[Presents unsigned tx for wallet signing]
```

### Step 3: Create a Collective ("Business")

```
User: "I want to create a stake pool collective in Sierra Nevada bioregion"

LLM: I'll create a collective for your stake pool operation.
[Calls build_create_collective]

Built transaction:
- Action: Create Collective
- Name: [Your Pool Name]
- Bioregion: Sierra Nevada (bioregion_sierranevada)
- Initial members: [Your pNFT]
- Governance: Single member (you can add more later)

Sign to create your collective.
```

### Step 4: Create Offering

```
User: "I want to offer stake pool operation services"

LLM: I'll create a service offering for stake pool operation.
[Calls build_create_offering]

Built offering:
- Category: Services > Infrastructure > Staking
- Description hash: ipfs://Qm...
- Availability: Ongoing
- Terms: Negotiable (you set rates per delegation)
- Expected impacts: Positive (supporting network decentralization)

Sign to list your offering.
```

### Step 5: Purchase from Development Pool

```
User: "I want to buy 1000 tokens from the development pool"

LLM: Querying development pool...
[Calls get_pool_state]

Development Pool Status:
- Available: 50,000,000 tokens
- Price: 1 ADA = 100 tokens (testnet)
- Your purchase: 1000 tokens = 10 ADA

[Calls build_purchase_from_pool]

Built transaction:
- Send: 10 ADA to development pool
- Receive: 1000 ULTRA tokens
- Impact: Neutral (development funding)

Sign to complete purchase.
```

---

## What We Need to Build (Ordered)

### Phase 1: Core Infrastructure
1. [ ] Deploy reference scripts to Preprod
2. [ ] Set up Blockfrost/Koios indexing
3. [ ] Build UltraLifeIndexer service
4. [ ] Build UltraLifeTxBuilder service

### Phase 2: MCP Integration
5. [ ] Create MCP server with UltraLife tools
6. [ ] Test with Claude, GPT, and local models
7. [ ] Document tool schemas

### Phase 3: Wallet Integration
8. [ ] Browser extension connector (Nami, Eternl, Lace)
9. [ ] Transaction signing flow
10. [ ] Confirmation UI

### Phase 4: Testnet Deployment
11. [ ] Deploy all contracts to Preprod
12. [ ] Create test pNFTs and bioregions
13. [ ] Seed development pool
14. [ ] Open for SPO testing

---

## Security Summary

| Layer | What It Does | Who Controls |
|-------|--------------|--------------|
| LLM | Parses intent, calls MCP tools | Any LLM provider |
| MCP Server | Reads chain, builds unsigned txs | UltraLife service |
| Wallet | Signs transactions | User (their keys) |
| Cardano | Validates and executes | Decentralized network |
| Reference Scripts | On-chain contract logic | Immutable once deployed |

**The LLM and MCP server together are the "convenience layer."**
**The wallet and Cardano together are the "security layer."**

No amount of bugs or malice in the convenience layer can bypass the security layer, because:
- Only the user's wallet has their keys
- Only Cardano validators decide what's valid
