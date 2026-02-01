# UltraLife Protocol: LLM Agent Guide

**Use your coding agent to interact with the protocol through conversation.**

Works with: Claude Code, Cursor, Windsurf, Copilot, Cody, or any LLM with terminal access.

---

## Setup (~3 minutes)

### 1. Clone the Repo

Open your LLM coding agent and say:

```
Clone https://github.com/ryanultralife/ultralife-protocol and set it up
```

Or manually:
```bash
git clone https://github.com/ryanultralife/ultralife-protocol
cd ultralife-protocol/scripts
npm install
```

### 2. Configure Credentials

Tell your agent:

```
Create a .env file in the scripts folder with:
- BLOCKFROST_API_KEY: (get free key from blockfrost.io, select preprod)
- WALLET_SEED_PHRASE: (24-word seed from Eternl/Nami on preprod)
- NETWORK: preprod
```

### 3. Get Test ADA

```
Get me test ADA from the Cardano faucet for address [YOUR_ADDRESS]
```

Faucet: https://docs.cardano.org/cardano-testnets/tools/faucet/

---

## Talk to the Protocol

Once setup is complete, just talk to your agent:

### Mint Your Identity

```
"Mint me a pNFT on preprod"
```

Agent runs: `npm run mint:pnft:basic`

### Check Deployment Status

```
"What validators are deployed? Show me the deployment.json"
```

### View Your pNFT

```
"Look up my pNFT on Cardanoscan"
```

### Explore the Codebase

```
"How does the pNFT minting work? Walk me through mint-pnft.mjs"
```

```
"What verification levels exist for pNFTs?"
```

```
"Explain the bioregion validator"
```

---

## Available Commands

| Command | What It Does |
|---------|--------------|
| `npm run mint:pnft:basic` | Mint a Basic level pNFT |
| `npm run deploy:references -- --all` | Deploy all validators |
| `npm run deploy:references -- --validator pnft` | Deploy specific validator |

---

## Example Conversation

**You:** "I want to test UltraLife on preprod. Set me up."

**Agent:**
```
I'll help you get set up. First, let me check if the repo is cloned...

The scripts are ready. I see you need a .env file.
Do you have a Blockfrost API key for preprod?
```

**You:** "Yes, it's preprod123abc. My seed phrase is: word word word..."

**Agent:**
```
I've created the .env file. Let me check your wallet balance...

Balance: 10,000 tADA

Ready to mint your first pNFT?
```

**You:** "Yes, mint it"

**Agent:**
```
Running npm run mint:pnft:basic...

🎉 pNFT MINTED!
ID: pnft_abc123_def456
Policy: 7c9f5578c7d5815c89af5d4f4635b2aa390e3ed06facdb3ecf9971fc
Tx: 959f5ba634a5fc5f0d9072c4b26c78536f7ec130689489233a3aa9aff8bfe51d

View: https://preprod.cardanoscan.io/transaction/959f5ba...
```

---

## What Your Agent Can Do

| Task | Just Ask |
|------|----------|
| Mint pNFT | "Mint me a pNFT" |
| Check balance | "What's my wallet balance?" |
| View deployment | "Show deployed validators" |
| Explain code | "How does the treasury validator work?" |
| Debug issues | "Why did this transaction fail?" |
| Read docs | "What are bioregions?" |
| Modify code | "Add a new verification level" |

---

## Troubleshooting

**"Script failed with insufficient funds"**
- Ask: "Check my wallet balance and UTxOs"

**"Policy ID mismatch"**
- Ask: "Compare deployed scriptHash with computed policyId"

**"Transaction rejected"**
- Ask: "What does this Plutus error mean?" (paste the error)

---

## Architecture Your Agent Should Know

```
ultralife-protocol/
├── validators/          # Aiken smart contracts (34 total)
├── plutus.json          # Compiled validators
├── scripts/
│   ├── testnet-config.mjs    # Centralized parameter config
│   ├── deploy-references.mjs # Deploy validators on-chain
│   ├── mint-pnft.mjs         # Mint identity NFTs
│   ├── deployment.json       # Deployed script references
│   └── .env                  # Your credentials (gitignored)
└── docs/
    ├── TESTNET_STATUS.md     # Current deployment state
    └── NASEC_TESTNET_GUIDE.md # Quick start
```

---

## Security Notes

- Your agent runs commands but **you control the wallet**
- Seed phrase stays in local `.env` (gitignored)
- All transactions are on **preprod testnet** (not real funds)
- Review what your agent does before sending to mainnet

---

## Next Steps

Once you've minted a pNFT, try:

```
"What else can I do with UltraLife?"
"How do I create a collective?"
"Explain the marketplace validator"
"What's the token distribution model?"
```

---

**The bar for participation is: can you talk?**

Your LLM agent is your interface to the protocol. Just ask.
