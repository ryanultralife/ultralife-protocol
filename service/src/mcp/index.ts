/**
 * UltraLife MCP Server
 * 
 * Model Context Protocol server that provides tools for LLMs to interact
 * with the UltraLife protocol on Cardano.
 * 
 * The LLM using these tools becomes the documentation - it can explain
 * what UltraLife is, how it works, and help users interact with it
 * through natural conversation.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { UltraLifeIndexer } from '../indexer/index.js';
import { UltraLifeTxBuilder } from '../builder/index.js';
import { ComposableTxBuilder, CompositionBundles } from '../builder/composable.js';
import type { UltraLifeConfig, CategoryRef, WhatOffered, LocationScope, Terms, CompoundFlow, ComposedActionInput } from '../types/index.js';

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
