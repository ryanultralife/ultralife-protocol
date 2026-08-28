/**
 * UltraLife MCP tool catalog + protocol context.
 * Split from index.ts so GitHub MCP can land the honesty file in two <40KB writes.
 * DNA/Standard is spec not live. Labor loop is unsigned preprod only.
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// =============================================================================
// PROTOCOL CONTEXT (What the LLM knows about UltraLife)
// =============================================================================

const ULTRALIFE_CONTEXT = `
UltraLife Protocol is a bioregion-based economic system on Cardano where:

IDENTITY (pNFT):
- pNFT = Personal NFT, on-chain identity. Spec is one per human after DNA uniqueness; that is not live.
- Live today (preprod): Basic mint via CLI. Basic cannot transact or bid (can_transact is level != Basic).
- Standard (DNA-verified) is protocol spec, not offered. Do not invent a DNA hash. Ryan signs any mint/upgrade.
- Spec levels: Basic → Standard (DNA) → Verified (bioregion) → Steward (community)
- Labor loop is NOT live until bid-escrow-pay has preprod tx hashes.

OFFERINGS & NEEDS:
- Anyone can offer anything: work, goods, knowledge, care, access
- Anyone can post needs: work requests, purchases, services needed
- Agreements form when offers match needs
- All transactions record compound flows (environmental impact)

COLLECTIVES:
- Groups of pNFTs working together (like a business)
- Have shared treasury and governance
- Can own resources and create offerings

BIOREGIONS:
- Geographic areas defined by ecological boundaries (not political)
- Track resource health: water, land, air, energy
- Track human wellbeing: health, education, housing, food security
- UBI distribution based on bioregion health

IMPACTS:
- Every transaction declares compound flows (CO2, H2O, etc.)
- Consumer accrues the impact of their purchases
- Creates accountability without middlemen

TOKENS:
- 400 billion total supply (single bonding curve)
- Used for all economic activity
- UBI distributed based on bioregion and participation
`;

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS: Tool[] = [
  // === INFORMATION TOOLS ===
  {
    name: 'get_ultralife_info',
    description: 'Get information about UltraLife Protocol - what it is, how it works, core concepts',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { 
          type: 'string', 
          description: 'Specific topic: identity, offerings, collectives, bioregions, impacts, tokens, or general',
          enum: ['general', 'identity', 'offerings', 'collectives', 'bioregions', 'impacts', 'tokens']
        },
      },
    },
  },
  {
    name: 'get_protocol_stats',
    description: 'Get overall UltraLife protocol statistics including total pNFTs, bioregions, active offerings, and TVL',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === pNFT TOOLS ===
  {
    name: 'get_pnft',
    description: 'Get details of a specific pNFT (personal identity NFT) by ID',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID to look up' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'get_pnft_by_address',
    description: 'Find a pNFT owned by a specific wallet address',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'The Cardano wallet address' },
      },
      required: ['address'],
    },
  },
  {
    name: 'get_token_balance',
    description: 'Get UltraLife token balance for a pNFT',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'list_pnfts',
    description: 'List pNFTs with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        min_level: { type: 'number', description: 'Minimum verification level (0-3)' },
        limit: { type: 'number', default: 10 },
      },
    },
  },

  // === SPENDING BUCKET TOOLS ===
  {
    name: 'list_buckets',
    description: 'List all spending buckets for a pNFT',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
      },
      required: ['pnft_id'],
    },
  },
  {
    name: 'get_bucket',
    description: 'Get details of a specific spending bucket',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        bucket_id: { type: 'string', description: 'The bucket ID' },
      },
      required: ['pnft_id', 'bucket_id'],
    },
  },
  {
    name: 'build_create_bucket',
    description: 'Build a transaction to create a new spending bucket with daily/weekly/monthly allocation and optional rollover',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        name: { type: 'string', description: 'Bucket name (e.g., "Daily Spending", "Emergency Fund")' },
        template: { 
          type: 'string', 
          enum: ['daily_spending', 'weekly_groceries', 'monthly_bills', 'emergency_fund', 'savings_goal', 'allowance', 'business_expense', 'custom'],
          description: 'Bucket template to use'
        },
        allocation: { type: 'number', description: 'Amount per period (for custom template)' },
        period: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'Period type (for custom template)' },
        rollover: { type: 'boolean', description: 'Enable rollover of unused funds (for custom template)' },
        max_balance: { type: 'number', description: 'Maximum accumulated balance (for custom template)' },
        initial_funding: { type: 'number', description: 'Initial ULTRA to deposit' },
      },
      required: ['pnft_id', 'name', 'template'],
    },
  },
  {
    name: 'build_fund_bucket',
    description: 'Build a transaction to add funds to an existing spending bucket',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        bucket_id: { type: 'string', description: 'The bucket ID to fund' },
        amount: { type: 'number', description: 'Amount of ULTRA to add' },
      },
      required: ['pnft_id', 'bucket_id', 'amount'],
    },
  },
  {
    name: 'build_spend_bucket',
    description: 'Build a transaction to spend from a bucket (operates in Hydra head if available)',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The sender pNFT ID' },
        bucket_id: { type: 'string', description: 'The bucket to spend from' },
        recipient_pnft: { type: 'string', description: 'The recipient pNFT ID' },
        amount: { type: 'number', description: 'Amount of ULTRA to spend' },
        purpose: { type: 'string', description: 'Purpose of the payment' },
      },
      required: ['pnft_id', 'bucket_id', 'recipient_pnft', 'amount'],
    },
  },
  {
    name: 'build_transfer_between_buckets',
    description: 'Build a transaction to transfer funds between your own buckets',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string', description: 'The pNFT ID' },
        from_bucket: { type: 'string', description: 'Source bucket ID' },
        to_bucket: { type: 'string', description: 'Destination bucket ID' },
        amount: { type: 'number', description: 'Amount to transfer' },
      },
      required: ['pnft_id', 'from_bucket', 'to_bucket', 'amount'],
    },
  },

  // === BIOREGION TOOLS ===
  {
    name: 'list_bioregions',
    description: 'List all registered bioregions with their health indices',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // === TREASURY & BONDING CURVE TOOLS ===
  {
    name: 'get_token_price',
    description: 'Get current bonding curve price. Price = tokens_distributed / 400B',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'simulate_purchase',
    description: 'Calculate how many tokens you would get for a given ADA amount',
    inputSchema: {
      type: 'object',
      properties: {
        ada_amount: { type: 'number', description: 'Amount of ADA to spend' },
      },
      required: ['ada_amount'],
    },
  },
  {
    name: 'get_founder_status',
    description: 'Get founder vesting status: accrued, claimed, available',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_treasury_status',
    description: 'Get full treasury status: reserves, distributed, epoch queue',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'build_purchase_tokens',
    description: 'Build transaction to buy tokens with ADA (queued for epoch settlement)',
    inputSchema: {
      type: 'object',
      properties: {
        buyer_pnft: { type: 'string', description: 'Buyer pNFT ID' },
        ada_amount: { type: 'number', description: 'ADA to spend' },
      },
      required: ['buyer_pnft', 'ada_amount'],
    },
  },

  {
    name: 'get_bioregion',
    description: 'Get detailed information about a specific bioregion including health indices',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion_id: { type: 'string', description: 'The bioregion ID' },
      },
      required: ['bioregion_id'],
    },
  },

  // === MARKETPLACE TOOLS ===
  {
    name: 'list_offerings',
    description: 'List marketplace offerings with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        offerer: { type: 'string', description: 'Filter by offerer pNFT ID' },
        category: { type: 'string', description: 'Filter by category code' },
        status: { type: 'string', enum: ['Active', 'Paused', 'Fulfilled', 'Expired', 'Cancelled'] },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'get_offering',
    description: 'Get details of a specific offering',
    inputSchema: {
      type: 'object',
      properties: {
        offering_id: { type: 'string', description: 'The offering ID' },
      },
      required: ['offering_id'],
    },
  },
  {
    name: 'list_needs',
    description: 'List work requests/needs with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        needer: { type: 'string', description: 'Filter by needer pNFT ID' },
        status: { type: 'string', enum: ['Open', 'InProgress', 'Fulfilled', 'Cancelled', 'Expired'] },
        limit: { type: 'number', default: 10 },
      },
    },
  },
  {
    name: 'get_need',
    description: 'Get details of a specific need/work request',
    inputSchema: {
      type: 'object',
      properties: {
        need_id: { type: 'string', description: 'The need ID' },
      },
      required: ['need_id'],
    },
  },


  // === WORK AUCTION (unsigned txs; not local JSON) ===
  {
    name: 'post_job',
    description: 'Build an UNSIGNED preprod CreateRequest tx for work_auction. Basic pNFTs are refused (can_transact). Minimum level: Standard. Does not submit; Ryan must sign. Not a local JSON write.',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string' },
        pnft_level: { type: 'string', description: 'On-chain level. Do not invent Standard.' },
        user_address: { type: 'string' },
        description: { type: 'string' },
        work_type: { type: 'string' },
        budget_min: { type: 'number' },
        budget_max: { type: 'number' },
        bid_deadline: { type: 'number', description: 'Absolute slot' },
        work_deadline: { type: 'number', description: 'Absolute slot' },
        min_worker_level: { type: 'string', default: 'Standard' },
        expected_impacts: { type: 'array', items: { type: 'object' }, description: 'Required, length >= 1. No invented compounds.' },
        specifications_hash: { type: 'string' },
        bioregion: { type: 'string' },
        asset: { type: 'string' },
      },
      required: ['pnft_id', 'pnft_level', 'user_address', 'description', 'budget_min', 'budget_max', 'expected_impacts'],
    },
  },
  {
    name: 'bid',
    description: 'Build an UNSIGNED SubmitBid tx. Basic cannot bid. Requires estimated_impacts. Not local JSON.',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string' },
        pnft_level: { type: 'string' },
        user_address: { type: 'string' },
        request_id: { type: 'string' },
        amount: { type: 'number' },
        proposed_completion: { type: 'number' },
        estimated_impacts: { type: 'array', items: { type: 'object' } },
        methods_hash: { type: 'string' },
      },
      required: ['pnft_id', 'pnft_level', 'user_address', 'request_id', 'amount', 'estimated_impacts'],
    },
  },
  {
    name: 'complete',
    description: 'Build UNSIGNED SubmitWork tx (alias of submit_work). evidence_hash required; no demo hashes.',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string' },
        user_address: { type: 'string' },
        escrow_id: { type: 'string' },
        evidence_hash: { type: 'string' },
        actual_impacts: { type: 'array', items: { type: 'object' } },
      },
      required: ['pnft_id', 'user_address', 'escrow_id', 'evidence_hash', 'actual_impacts'],
    },
  },
  {
    name: 'accept_bid',
    description: 'Build UNSIGNED AcceptBid + escrow lock. Requester only.',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string' },
        user_address: { type: 'string' },
        bid_id: { type: 'string' },
        request_id: { type: 'string' },
        worker_pnft: { type: 'string' },
        amount: { type: 'number' },
        work_deadline: { type: 'number' },
      },
      required: ['pnft_id', 'user_address', 'bid_id', 'request_id', 'worker_pnft', 'amount'],
    },
  },
  {
    name: 'submit_work',
    description: 'Build UNSIGNED SubmitWork. Escrow must be WorkStarted. evidence_hash required.',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string' },
        user_address: { type: 'string' },
        escrow_id: { type: 'string' },
        evidence_hash: { type: 'string' },
        actual_impacts: { type: 'array', items: { type: 'object' } },
      },
      required: ['pnft_id', 'user_address', 'escrow_id', 'evidence_hash', 'actual_impacts'],
    },
  },
  {
    name: 'release_payment',
    description: 'Build UNSIGNED ReleasePayment. Escrow must already be Verified on-chain.',
    inputSchema: {
      type: 'object',
      properties: {
        pnft_id: { type: 'string' },
        user_address: { type: 'string' },
        escrow_id: { type: 'string' },
        worker_address: { type: 'string', description: 'Worker payment address; not invented' },
      },
      required: ['pnft_id', 'user_address', 'escrow_id', 'worker_address'],
    },
  },

  // === COLLECTIVE TOOLS ===
  {
    name: 'list_collectives',
    description: 'List collectives (organizations/businesses) with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        bioregion: { type: 'string', description: 'Filter by bioregion ID' },
        member: { type: 'string', description: 'Filter by member pNFT ID' },
      },
    },
  },
  {
    name: 'get_collective',
    description: 'Get details of a specific collective',
    inputSchema: {
      type: 'object',
      properties: {
        collective_id: { type: 'string', description: 'The collective ID' },
      },
      required: ['collective_id'],
    },
  },

  // === TRANSACTION BUILDING TOOLS ===
  {
    name: 'build_mint_pnft',
    description: 'Build an UNSIGNED preprod tx to mint a Basic pNFT (wallet signature only). Not DNA-verified. Does not submit. Ryan must sign. Do not invent a DNA hash.',
    inputSchema: {
      type: 'object',
      properties: {
        user_address: { type: 'string', description: 'The wallet address for the new pNFT' },
        dna_hash: { type: 'string', description: 'Optional. Omit for Basic mint. Do not invent a test_ hash. Standard upgrade is Ryan-signed with a real unique hash, not this tool.' },
        verification_proof: { type: 'string', description: 'Optional. Omit for Basic. Do not invent testnet_proof.' },
      },
      required: ['user_address'],
    },
  },
  {
    name: 'build_create_offering',
    description: 'Build a transaction to create a new marketplace offering. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        offerer_pnft: { type: 'string', description: 'The pNFT ID of the offerer' },
        what_type: { type: 'string', enum: ['Thing', 'Work', 'Access', 'Knowledge', 'Care'], description: 'Type of offering' },
        description: { type: 'string', description: 'Description of what is being offered' },
        bioregion: { type: 'string', description: 'Bioregion where offering is available (or "anywhere")' },
        price: { type: 'number', description: 'Price in tokens (0 for gift/community service)' },
        negotiable: { type: 'boolean', default: true, description: 'Whether price is negotiable' },
      },
      required: ['offerer_pnft', 'what_type', 'description'],
    },
  },
  {
    name: 'build_create_collective',
    description: 'Build a transaction to create a new collective (organization/business). Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        founder_pnft: { type: 'string', description: 'The pNFT ID of the founder' },
        name: { type: 'string', description: 'Name of the collective' },
        bioregion: { type: 'string', description: 'Bioregion where collective is based' },
        governance_description: { type: 'string', description: 'Description of governance rules' },
      },
      required: ['founder_pnft', 'name', 'bioregion'],
    },
  },
  {
    name: 'build_add_collective_member',
    description: 'Build a transaction to add a member to a collective. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        collective_id: { type: 'string', description: 'The collective ID' },
        new_member_pnft: { type: 'string', description: 'The pNFT ID of the new member' },
        approver_pnft: { type: 'string', description: 'The pNFT ID of the approving existing member' },
      },
      required: ['collective_id', 'new_member_pnft', 'approver_pnft'],
    },
  },
  {
    name: 'build_transfer_tokens',
    description: 'Build a transaction to transfer tokens between pNFTs. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        sender_pnft: { type: 'string', description: 'The sender pNFT ID' },
        sender_address: { type: 'string', description: 'The sender wallet address' },
        recipient_pnft: { type: 'string', description: 'The recipient pNFT ID' },
        recipient_address: { type: 'string', description: 'The recipient wallet address' },
        amount: { type: 'number', description: 'Amount of tokens to transfer' },
        purpose: { type: 'string', description: 'Purpose of the transfer (for record keeping)' },
      },
      required: ['sender_pnft', 'sender_address', 'recipient_pnft', 'recipient_address', 'amount', 'purpose'],
    },
  },
  {
    name: 'build_accept_offering',
    description: 'Build a transaction to accept an offering and create an agreement. Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        offering_id: { type: 'string', description: 'The offering ID to accept' },
        accepter_pnft: { type: 'string', description: 'The pNFT ID of the accepter' },
        payment: { type: 'number', description: 'Payment amount in tokens' },
        complete_by_days: { type: 'number', default: 30, description: 'Days until completion deadline' },
      },
      required: ['offering_id', 'accepter_pnft', 'payment'],
    },
  },
  {
    name: 'build_purchase_from_pool',
    description: 'Build a transaction to purchase tokens from the development pool (testnet only). Returns unsigned transaction for wallet signing.',
    inputSchema: {
      type: 'object',
      properties: {
        buyer_address: { type: 'string', description: 'The buyer wallet address' },
        ada_amount: { type: 'number', description: 'Amount of ADA to spend (1 ADA = 100 tokens on testnet)' },
      },
      required: ['buyer_address', 'ada_amount'],
    },
  },

  // === DIGITAL ASSET TWIN TOOLS ===
  // No scanning required - query ledger directly for all asset history
  {
    name: 'get_asset',
    description: 'Get complete details of a digital asset twin (land, building, vehicle, equipment). Returns all attributes, service history, and automation endpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
      },
      required: ['asset_id'],
    },
  },
  {
    name: 'get_asset_service_history',
    description: 'Get complete service history for an asset directly from ledger. No scanning needed - all past services are recorded on-chain.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
        service_type: { type: 'string', description: 'Filter by service type (e.g., "maintenance", "repair", "inspection")' },
        performer: { type: 'string', description: 'Filter by performer pNFT ID' },
        from_date: { type: 'number', description: 'Filter from this slot number' },
        to_date: { type: 'number', description: 'Filter to this slot number' },
        limit: { type: 'number', default: 50, description: 'Maximum results to return' },
      },
      required: ['asset_id'],
    },
  },
  {
    name: 'list_assets',
    description: 'List all digital asset twins owned by a pNFT. Includes land, buildings, vehicles, equipment.',
    inputSchema: {
      type: 'object',
      properties: {
        owner_pnft: { type: 'string', description: 'The owner pNFT ID' },
        category: { type: 'string', enum: ['Land', 'Building', 'Vehicle', 'Machinery', 'Equipment', 'Infrastructure', 'Appliance'], description: 'Filter by asset category' },
        limit: { type: 'number', default: 50 },
      },
      required: ['owner_pnft'],
    },
  },
  {
    name: 'get_asset_current_state',
    description: 'Get current state of an asset from IoT sensors (temperature, fuel level, location, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
      },
      required: ['asset_id'],
    },
  },

  // === AUTOMATION CONTROL TOOLS ===
  // Control IoT devices from the same LLM interface
  {
    name: 'list_automations',
    description: 'List all automation endpoints for an asset (lights, HVAC, locks, irrigation, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
      },
      required: ['asset_id'],
    },
  },
  {
    name: 'get_automation_commands',
    description: 'Get available commands for a specific automation endpoint',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
        endpoint_id: { type: 'string', description: 'The automation endpoint ID' },
      },
      required: ['asset_id', 'endpoint_id'],
    },
  },
  {
    name: 'execute_automation',
    description: 'Execute an automation command (e.g., turn on lights, lock doors, set thermostat). Requires owner permission.',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
        endpoint_id: { type: 'string', description: 'The automation endpoint ID' },
        command_id: { type: 'string', description: 'The command to execute' },
        parameters: { type: 'object', description: 'Command parameters (e.g., { "temperature": 22 })' },
        executor_pnft: { type: 'string', description: 'The pNFT ID of the person executing the command' },
      },
      required: ['asset_id', 'endpoint_id', 'command_id', 'executor_pnft'],
    },
  },
  {
    name: 'grant_automation_permission',
    description: 'Grant another pNFT permission to control automations on your asset',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
        owner_pnft: { type: 'string', description: 'The owner pNFT ID (must be asset owner)' },
        grantee_pnft: { type: 'string', description: 'The pNFT ID to grant permission to' },
        allowed_commands: { type: 'array', items: { type: 'string' }, description: 'List of allowed command IDs (empty = all)' },
        expires_at: { type: 'number', description: 'When permission expires (slot number)' },
      },
      required: ['asset_id', 'owner_pnft', 'grantee_pnft'],
    },
  },
  {
    name: 'build_register_asset',
    description: 'Build a transaction to register a new physical asset as a digital twin on-chain',
    inputSchema: {
      type: 'object',
      properties: {
        owner_pnft: { type: 'string', description: 'The owner pNFT ID' },
        category: { type: 'string', enum: ['Land', 'Building', 'Vehicle', 'Machinery', 'Equipment', 'Infrastructure', 'Appliance'], description: 'Asset category' },
        name: { type: 'string', description: 'Asset name' },
        description: { type: 'string', description: 'Asset description' },
        specs: { type: 'object', description: 'Category-specific specifications' },
        bioregion: { type: 'string', description: 'Bioregion where asset is located' },
      },
      required: ['owner_pnft', 'category', 'name'],
    },
  },
  {
    name: 'build_record_service',
    description: 'Build a transaction to record a service performed on an asset',
    inputSchema: {
      type: 'object',
      properties: {
        asset_id: { type: 'string', description: 'The asset ID' },
        service_type: { type: 'string', description: 'Type of service (maintenance, repair, inspection, etc.)' },
        performer_pnft: { type: 'string', description: 'The pNFT ID of who performed the service' },
        description: { type: 'string', description: 'Description of work done' },
        amount_paid: { type: 'number', description: 'Payment amount in tokens' },
        impact_compounds: { type: 'array', items: { type: 'object' }, description: 'Environmental impact compounds' },
        evidence_hash: { type: 'string', description: 'IPFS hash of evidence/photos' },
      },
      required: ['asset_id', 'service_type', 'performer_pnft', 'description'],
    },
  },

  // === COMPOSED TRANSACTION TOOLS (Fallen Icarus-style bundling) ===
  {
    name: 'build_composed_transaction',
    description: 'Build a transaction with multiple actions bundled together for lower fees. Supports onboarding, marketplace, settlement, and impact bundles.',
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          description: 'Array of actions to compose into a single transaction',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['mint_pnft', 'create_offering', 'accept_offering', 'transfer', 'claim_ubi', 'record_impact', 'create_bucket', 'fund_bucket', 'spend_bucket', 'create_collective', 'add_collective_member', 'claim_grant'],
                description: 'Action type',
              },
              params: {
                type: 'object',
                description: 'Action-specific parameters',
              },
            },
            required: ['type', 'params'],
          },
        },
      },
      required: ['actions'],
    },
  },
  {
    name: 'get_composition_bundles',
    description: 'Get predefined composition bundles for common multi-action patterns',
    inputSchema: {
      type: 'object',
      properties: {
        bundle_type: {
          type: 'string',
          enum: ['onboarding', 'marketplace', 'settlement', 'impact', 'all'],
          description: 'Type of bundle to get info about',
        },
      },
    },
  },
  {
    name: 'estimate_composed_fees',
    description: 'Estimate fees for a composed transaction before building',
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          description: 'Array of actions to estimate fees for',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              params: { type: 'object' },
            },
            required: ['type', 'params'],
          },
        },
      },
      required: ['actions'],
    },
  },
];

export { ULTRALIFE_CONTEXT, TOOLS };
