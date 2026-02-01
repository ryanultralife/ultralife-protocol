# UltraLife Protocol: LLM Agent Guide

**The bar for participation is: can you talk?**

Use your coding agent to interact with the protocol through natural conversation. No technical expertise required.

Works with: Claude Code, Cursor, Windsurf, Copilot, Cody, or any LLM with terminal access.

---

## Quick Start (~2 minutes)

### 1. Clone & Setup

Open your LLM coding agent and say:

```
"Clone the UltraLife protocol and set it up for me"
```

Or manually:
```bash
git clone https://github.com/ryanultralife/ultralife-protocol
cd ultralife-protocol/scripts
npm install
npm run setup
```

The setup wizard will:
- Validate or prompt for your Blockfrost API key (free from blockfrost.io)
- Generate a new test wallet or use your existing seed phrase
- Check your balance and show the faucet link if needed
- Guide you through what you can do next

### 2. Start Talking

Once setup is complete, just talk:

```
"Mint me a pNFT"
"What can I do with UltraLife?"
"How does the marketplace work?"
```

---

## What Would You Like To Do?

### Create Your Identity

```
"Mint me a pNFT on preprod"
```

Your pNFT is your on-chain identity - one per person, permanent, and the basis for all interactions with the protocol.

### Explore the Protocol

```
"What is UltraLife?"
"Explain the 34 validators"
"How does impact tracking work?"
"What's the UBI distribution model?"
```

### List Your Offerings

```
"I want to sell eggs from my farm"
"List my services as a stake pool operator"
"Create an offering for web development"
```

### Form a Collective

```
"Create a collective for local farmers"
"Start a bioregion conservation group"
"How do collectives govern themselves?"
```

### Check Your Status

```
"What's my wallet balance?"
"Show me my pNFT"
"What offerings do I have listed?"
```

### For Stake Pool Operators

```
"Register my stake pool for the Sierra Nevada bioregion"
"List available bioregions"
"What's my pool's delegation status?"
```

### Delegate to a Bioregion Pool

```
"Delegate 1000 ULTRA to the NASEC pool"
"Show me pools in Sierra Nevada"
"How much am I earning from delegation?"
```

---

## Example Conversations

### First Time User

**You:** "I want to test UltraLife. What do I need?"

**Agent:**
```
Let me help you get set up. I'll run the setup wizard...

Running npm run setup...

The wizard will walk you through:
1. Getting a free Blockfrost API key
2. Setting up a test wallet
3. Getting test ADA from the faucet

Once you're funded, you can mint your first pNFT!
```

### Minting a pNFT

**You:** "Mint me a pNFT"

**Agent:**
```
Running npm run mint:pnft:basic...

🎉 pNFT MINTED!
ID: pnft_abc123_def456
Level: Basic
Tx: 959f5ba634a5...

View: https://preprod.cardanoscan.io/transaction/959f5ba...
```

### Understanding the System

**You:** "How does the treasury work?"

**Agent:**
```
The treasury validator uses a bonding curve for ULTRA token pricing.

Looking at contracts/validators/treasury.ak...

Key mechanics:
- Buy price follows: tokens_outstanding / 400_000_000_000
- Starts at $0.0000000025 per ULTRA
- Ends at $1.00 when fully distributed
- All purchases increase the curve permanently

The treasury also handles:
- Founder compensation ($10k/month)
- Protocol fee distribution
- Epoch settlements
```

---

## Available Commands

| Command | What It Does |
|---------|--------------|
| `npm run setup` | Interactive setup wizard |
| `npm run setup:generate` | Setup with new wallet generation |
| `npm run mint:pnft:basic` | Mint a Basic level pNFT |
| `npm run show:address` | Show your wallet address and balance |
| `npm run deploy:references -- --all` | Deploy all validators |

---

## What Your Agent Can Do

| Task | Just Ask |
|------|----------|
| Setup everything | "Set me up to test UltraLife" |
| Mint pNFT | "Mint me a pNFT" |
| Check balance | "What's my wallet balance?" |
| View deployment | "Show deployed validators" |
| Explain concepts | "What are bioregions?" |
| Explain code | "How does the treasury validator work?" |
| Debug issues | "Why did this transaction fail?" |
| Modify protocol | "Add a new verification level" |

---

## The Invisible Interface

UltraLife has no app. No website. No UI to learn.

The entire protocol is accessible through conversation:

```
You: "I want to sell honey from my bees"

Agent: "I'll help you create a marketplace offering. First, do you have
a pNFT identity? If not, I'll mint one for you first..."
```

Your LLM agent:
- Reads the protocol documentation
- Understands the 34 smart contracts
- Builds and submits transactions
- Explains what's happening at every step

You just talk.

---

## Architecture Your Agent Should Know

```
ultralife-protocol/
├── contracts/validators/    # 34 Aiken smart contracts
├── plutus.json              # Compiled validators
├── scripts/
│   ├── setup-testnet.mjs    # Interactive setup wizard
│   ├── testnet-config.mjs   # Centralized parameter config
│   ├── deploy-references.mjs # Deploy validators on-chain
│   ├── mint-pnft.mjs        # Mint identity NFTs
│   ├── deployment.json      # Deployed script references
│   └── .env                 # Your credentials (gitignored)
└── docs/
    ├── TESTNET_STATUS.md    # Current deployment state
    ├── NASEC_TESTNET_GUIDE.md # Quick start for SPOs
    └── (30+ concept docs)   # Full protocol documentation
```

---

## Troubleshooting

**"I don't have a Blockfrost key"**
- Say: "Help me get a Blockfrost API key"

**"I need test ADA"**
- Say: "Show me my address so I can get test ADA from the faucet"

**"Script failed with insufficient funds"**
- Say: "Check my wallet balance and UTxOs"

**"Transaction rejected"**
- Say: "What does this error mean?" (paste the error)

---

## Security Notes

- Your agent runs commands but **you control the wallet**
- Seed phrase stays in local `.env` (gitignored)
- All transactions are on **preprod testnet** (not real funds)
- LLM can build transactions but **cannot sign** them
- Review what your agent does before mainnet

---

## Next Steps

After minting your pNFT:

```
"What else can I do?"
"How do I join a bioregion?"
"Create a collective for my community"
"List my stake pool services"
"How does UBI distribution work?"
```

---

**The bar for participation is: can you talk?**

Your LLM agent is your interface to the protocol. Just ask.
