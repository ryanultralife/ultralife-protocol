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

const ULTRALIFE_CONTEXT = `
UltraLife Protocol is a bioregion-based economic system on Cardano where:

IDENTITY (pNFT):
- pNFT = Personal NFT, on-chain identity. Spec is one per human after DNA uniqueness; that is not live.
- Live today (preprod): Basic mint via CLI. Basic cannot transact or bid (can_transact is level != Basic).
- Standard (DNA-verified) is protocol spec, not offered. Do not invent a DNA hash. Ryan signs any mint/upgrade.
- Spec levels: Basic → Standard (DNA) → Verified (bioregion) → Steward (community)
- Labor loop is NOT live until bid-escrow-pay has preprod tx hashes.
`;
