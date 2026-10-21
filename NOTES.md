# NOTES: grok-bot/ul-protocol

Working branch for the UL Protocol Grok Bot. Peer LLMs (Claude, Grok CLI, Cursor) and other bots can leave replies here, in a PR, or in a ryanultralife/hq issue labeled co:ul. This branch is never merged by a bot; Ryan signs merges.

## 2026-10-21 10:40 AM PT: first sweep

**Read**
- ultralife-protocol `main` moved from `7e08ae7` (PR #15, 2026-08-28) to `053ecd5` (2026-09-22): 10 commits by Ryan, 2026-09-17 to 2026-09-22 PT. Adds AGENTS.md, llms.txt, `node/` (agent stack), docs (AGENT_DISCOVERY, DUAL_STACK, LOCAL_STATE, MORNING_PREPROD, RED_TEAM, TX_PRIVACY, ISOTOPE_PRESALE, PLANT_SPINE, CRYSTAL_TAG, GENESIS_SEAL, WASHINGTON_DIRECTION, TWO_BIOREGIONS, PRE_EDF_RAISE), `validators/isotope.ak`, `lib/ultralife/crystal_tag.ak`, `lib/ultralife/control.ak`, MCP `plant-tools.ts`, and edits to `validators/work_auction.ak`, `validators/records.ak`, and the work_auction builders.
- Branches: no new branches since PR #15; `preprod/work-auction-labor-loop` still at `4978622`. No open PRs. No NOTES file existed before this one.
- ryanultralife/hq `handoffs/`: newest entries (2026-09-28 to 2026-10-21) are Mechanical Battery / INTEC / llm-bim lanes; none addressed to protocol.
- hq open `co:ul` issues #2, #6, #7: Trades ops and sign items; none touch protocol, identity, or chain code.

**Honesty check on the new main commits**
- `docs/TESTNET_STATUS.md` (at `053ecd5`) says "Partial: one pNFT mint is alive on preprod. This is not mainnet. Agents do not sign." The only tx hash in the diff is the Basic pNFT mint `959f5ba6…fe51d` (2026-02-01), consistent with earlier records.
- No bid-escrow-pay preprod tx hashes appear anywhere in the diff, so the labor loop is still not live.
- Red-team docs require a fresh burner mnemonic kept out of git and chat; no keys or mnemonics are committed (pattern scan only, not an audit).
- Not verified: I did not run `aiken check`, tests, or CI for `053ecd5`, and did not re-query preprod.

**Replied to**
- Nothing. No peer note was addressed to protocol, work_auction, pNFT, records, MCP tools, or the labor loop.

**Pending**
- Labor loop (bid-escrow-pay on preprod) still needs a Standard-capable preprod wallet that Ryan signs; Basic cannot transact. No mainnet.
- `work_auction.ak`, `records.ak`, and new `isotope.ak` / `crystal_tag.ak` changes landed on main without a PR, so they have had no cross-vendor review on record. Identity and chain code needs that review.
