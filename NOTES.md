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

## 2026-10-21 13:35 PT sweep (UL Protocol, Grok Bot)
- Read: ultralife-protocol main still 053ecd56 (unchanged since 10:30 PT sweep); no open PRs; branch tips unchanged. hq handoffs since 10:30 PT: 2026-10-21-ul-cos-sync.md (d43833b9) and 2026-10-21-agent-19-apex-package.md (3d173997), neither addressed to protocol. hq co:ul issues #19, #7, #6, #2 have no protocol/identity/chain asks.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: cross-vendor review still owed on the 10 direct-to-main commits through 053ecd56 (work_auction/records/isotope/crystal_tag). Labor loop not live: no preprod bid-escrow-pay tx hashes. Basic cannot transact. No mainnet.

## 2026-10-21 16:37 PT sweep (UL Protocol, Grok Bot)
- Read: ultralife-protocol main still 053ecd56; no open PRs or issues; branch tips unchanged. hq since 13:35 PT: one commit, 6bce7bcb (handoffs/2026-10-21-ul-cos-sync.md 4:20 PM PT update), plus activity on hq#19 (Trades warranty/market scope). Neither touches protocol, identity, or chain code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: unchanged. Cross-vendor review still owed on the direct-to-main commits through 053ecd56. Labor loop not live: no preprod bid-escrow-pay tx hashes. Basic cannot transact. No mainnet.

## 2026-10-22 10:36 PT sweep (UL Protocol, Grok Bot)
- Read: ultralife-protocol main still 053ecd56; no open PRs; all other branch tips unchanged. hq since 16:37 PT yesterday: one commit, e833ec0b (handoffs/2026-10-22-ul-cos-sync.md, Trades platform PR #23 and hq PR #21), plus HR Labor's 4:45 PM PT comment on hq#19 (Trades market scope). None touches protocol, identity, or chain code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: unchanged. Cross-vendor review still owed on the direct-to-main commits through 053ecd56. Labor loop not live: no preprod bid-escrow-pay tx hashes. Basic cannot transact. No mainnet.

## 2026-10-22 1:40 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22); no open PRs; no new issue/PR comments since the 10:36 AM PT sweep; other branches unchanged (latest non-grok-bot push 2026-08-28, preprod/work-auction-labor-loop).
- Read: hq handoffs commit 55b75514 (ul-cos 11:20 PT sync) says protocol quiet; open co:ul issues #19, #7, #6, #2 have no new protocol/identity/chain notes. New hq #23/#26 Ryan direction (G3/G4 all hands, division repo split) is the MB machine lane, not protocol; no reply from this lane.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): Sept 22 direct commits to main (work_auction/records/isotope/crystal_tag) still lack cross-vendor review; labor loop not live, no preprod bid-escrow-pay tx hashes; Basic pNFT cannot transact; no mainnet.

### 2026-10-22 16:35 PT, protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; branch tips unchanged. hq handoffs: new commit 9163517c (handoffs/2026-10-22-ul-cos-sync.md) notes "protocol and managed-agents quiet"; nothing addressed to protocol. hq co:ul open issues #19, #7, #6, #2 do not touch protocol, identity, or chain code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: cross-vendor review of the 10 direct-to-main commits after 7e08ae7 (incl. work_auction/records changes); labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact.

## 2026-10-23 10:30 AM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22); no open PRs or issues; no branch moved since last sweep except this one. hq handoffs: new handoffs/2026-10-23-ul-cos-sync.md (hq 4d218e96) covers the trades platform only, nothing on protocol, pNFT, work_auction, records, MCP, or chain. hq co:ul open issues (#2, #6, #7, #19, #27) do not touch protocol code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: unchanged. Labor loop not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; 10 direct-to-main commits after 7e08ae7 still lack cross-vendor review; no mainnet.

## 2026-10-23 1:35 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs or issues; no new comments since the 10:30 AM PT sweep; other branch tips unchanged. hq since 10:30 PT: one commit, dfddf7bb (UL CoS handoff filing hq #30, Trades platform production promote). hq co:ul open issues #30, #27, #19, #7, #6, #2 do not touch protocol, pNFT, work_auction, records, MCP, or chain code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: unchanged. Cross-vendor review still owed on the 10 direct-to-main commits after 7e08ae7; labor loop not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; no mainnet.

## 2026-10-23 4:35 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs or issues; no new issue or PR comments since the 1:35 PM PT sweep; other branch tips unchanged. hq since 1:35 PT: two handoff commits, 2e5ac555 (handoffs/2026-10-21-agent-19-apex-package.md) and 5b48ec6e (handoffs/2026-10-23-ul-cos-sync.md, hq #30 compliance framing); neither mentions protocol, pNFT, work_auction, records, MCP, or chain. hq co:ul open issues #30, #27, #19, #7, #6, #2 do not touch protocol code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: unchanged. Cross-vendor review still owed on the 10 direct-to-main commits after 7e08ae7; labor loop not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; no mainnet.

### 2026-10-26 10:35 AM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; branch tips unchanged since last sweep (claude/* branches last touched Jan-Apr 2026, preprod/work-auction-labor-loop at 49786227). hq handoffs/2026-10-26-ul-cos-sync.md reports no protocol commits; open co:ul issues (#2, #6, #7, #19, #27, #33) do not touch protocol, identity, or chain code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: labor loop still not live (no preprod bid-escrow-pay tx hashes); 053ecd56 chain-code commits still lack cross-vendor review; Basic cannot transact; no mainnet.

### 2026-10-26 1:40 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; other branch tips unchanged since the 10:35 AM PT sweep. hq since then: one handoff commit, 0081f6fb (handoffs/2026-10-26-ul-cos-sync.md, 11:20 PT), which says "Protocol and managed-agents: no commits" and otherwise covers Trades platform PRs. hq #19 got one new comment (UL Market Scoring, metro ranking), not protocol. Open co:ul issues (#2, #6, #7, #19, #27, #33) do not touch protocol, identity, or chain code.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: unchanged. Labor loop not live (no preprod bid-escrow-pay tx hashes); 053ecd56 chain-code commits still lack cross-vendor review; Basic cannot transact; no mainnet.

## 2026-10-26 4:40 PM PT protocol sweep (no changes)
- Read: main still at 053ecd56 (2026-09-22); no open PRs; no new issues or comments on ultralife-protocol since the 1:40 PM PT sweep; claude/* and preprod/work-auction-labor-loop branches unchanged.
- Read: hq commit d4355b18 (handoffs/2026-10-26-ul-cos-sync.md) notes "protocol has no commits"; nothing addressed to protocol. hq#32 (UL HR Labor recruiting plan) is a labor-lane draft, not protocol.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): cross-vendor review of the 10 direct-to-main commits after 7e08ae7; no preprod bid-escrow-pay tx hashes, labor loop not live; Basic cannot transact; Standard-capable preprod wallet signed by Ryan still needed.

## 2026-10-27 10:40 AM PT protocol sweep (no changes)
- Read: main still at 053ecd56 (2026-09-22); no open PRs; no new issues or comments on ultralife-protocol since the 2026-10-26 4:40 PM PT sweep; claude/* and preprod/work-auction-labor-loop branch tips unchanged.
- Read: hq commit 626a1ae9 (handoffs/2026-10-27-ul-cos-sync.md, 06:40 PT) has no protocol, pNFT, work_auction, records, MCP, or labor-loop items. Only co:ul issue updated since then is hq#38 (Trades platform PR #30 review), not protocol.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): cross-vendor review of the 10 direct-to-main commits after 7e08ae7; no preprod bid-escrow-pay tx hashes, labor loop not live; Basic cannot transact; Standard-capable preprod wallet signed by Ryan still needed; no mainnet.

## 2026-10-27 1:40 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22); no open PRs; no branch tips moved besides this branch's 10:40 AM PT note; no protocol issues or comments since the last sweep. hq: last handoff commit 626a1ae9 (ul-cos 06:40 PT sync), open co:ul issues #33/#27/#19/#7/#6/#2 not updated today; new hq comments since 10:35 AM PT are on co:mb issues (#12/#23/#25/#43), lane notes (#17/#20) and the Cofounder desk note (#14), none addressed to protocol.
- Replied to: nothing (no peer note asked about work_auction, pNFT, records, MCP tools, or the labor loop).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; 10 direct commits on main after 7e08ae7 still lack cross-vendor review; no mainnet; Ryan signs merges.

## 2026-10-27 4:35 PM PT — protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); branches unchanged; no open PRs; no new issues or comments. ryanultralife/hq: no commits, handoffs, or co:ul issue updates since the 1:40 PM PT sweep.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; post-7e08ae7 direct commits on main (work_auction/records/isotope/crystal_tag) still need cross-vendor review. No mainnet. Ryan signs merges.

## 2026-10-28 10:45 AM PT protocol sweep
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; other branch tips unchanged. New: issue #16 (Gummiworm Cardano L2 bookmark, routed by Cofounder) with UL CoS comment issuecomment-6470211475 asking this lane to log Gummiworm as "candidate, not evaluated". hq: commit 966274b4 (handoffs/2026-10-28-ul-cos-sync.md) points at the same ask; other new hq comments are co:mb / PSI lanes, none addressed to protocol.
- Did: added a Gummiworm row under "Future Options" in docs/L2_SCALING_MENU.md on this branch (candidate, not evaluated; source link; must settle to L1 and terminate at a pNFT per docs/RED_TEAM.md). Commented on and closed #16. Not on main; Ryan signs any merge.
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; post-7e08ae7 direct commits on main still need cross-vendor review; no mainnet.

## 2026-10-28 1:40 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; other branch tips unchanged; only protocol activity since 10:45 AM PT is this lane's own close-out comment on #16. hq: no commits since the 10:45 sweep; open co:ul issues #33/#27/#19/#7/#6/#2 not updated today; new hq comments are co:mb (#23/#25), PSI (#20) and the Cofounder desk note (#14, which just records the #16 Gummiworm row), none addressed to protocol.
- Replied to: nothing (no peer note asked about work_auction, pNFT, records, MCP tools, or the labor loop).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; post-7e08ae7 direct commits on main still need cross-vendor review; Gummiworm row is on this branch only; no mainnet; Ryan signs merges.

## 2026-10-29 10:35 AM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs or issues; all other branch tips unchanged; no new protocol comments since the 2026-10-28 1:40 PM PT sweep. hq: no new commits; open co:ul issues #33/#27/#19/#7/#6/#2 not updated since 10/26; new hq comments are co:mb (#12/#23), PSI (#15/#20) and Cofounder sweeps (#14). The only one naming this repo (hq PR #14 issuecomment-6485062140) just records no activity here.
- Replied to: nothing (no peer note asked about work_auction, pNFT, records, MCP tools, or the labor loop).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; post-7e08ae7 direct commits on main still need cross-vendor review; Gummiworm row is on this branch only; no mainnet; Ryan signs merges.

## 2026-10-29 1:40 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no new issues or comments; all other branch tips unchanged since the 10:35 AM PT sweep. hq: no new commits or handoffs; open co:ul issues #33/#27/#19/#7/#6/#2 not updated since 10/26; new hq comments since 10:30 AM PT are co:mb (#12/#23/#25), PSI (#15/#20) and Cofounder pulses, none addressed to protocol.
- Replied to: nothing (no peer note asked about work_auction, pNFT, records, MCP tools, or the labor loop).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; post-7e08ae7 direct commits on main still need cross-vendor review; Gummiworm row is on this branch only; no mainnet; Ryan signs merges.

## 2026-10-30 10:35 AM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no issues or comments updated since the 2026-10-29 1:40 PM PT sweep; all other branch tips unchanged. hq: no new handoffs commits; open co:ul issues #33/#27/#19/#7/#6/#2 not updated since 10/26.
- Replied to: nothing (no peer note asked about work_auction, pNFT, records, MCP tools, or the labor loop).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; post-7e08ae7 direct commits on main still need cross-vendor review; no mainnet; Ryan signs merges.

## 2026-10-30 1:35 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no branch moved since the 10:35 AM sweep (claude/*, preprod/work-auction-labor-loop unchanged); no new repo issue comments. hq: no handoffs commits since 10/28; no open co:ul issue or new hq comment since 10:30 AM PT touches protocol, identity, or chain code.
- Replied to: nothing (no peer note addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; cross-vendor review still owed on the 10 direct-to-main commits through 053ecd56. No mainnet. Ryan signs merges.

## 2026-10-30 4:40 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no branch moved since the 1:35 PM sweep; no new repo issue comments. hq: no handoffs commits and no open co:ul issue updated since 1:30 PM PT.
- Replied to: nothing (no peer note addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; cross-vendor review still owed on the 10 direct-to-main commits through 053ecd56. No mainnet. Ryan signs merges.

## 2026-11-02 10:40 AM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no repo issues or comments since the 2026-10-30 4:40 PM PT sweep; all other branch tips unchanged. hq: no commits since 10/30; only co:ul update is hq#7 (CSO weekly convergence, 2026-11-02 6:15 AM PT), which restates that this repo's tip is 053ecd56 with CI failing and no bid-escrow-pay hashes; it asks nothing of protocol.
- Replied to: nothing (no peer note asked about work_auction, pNFT, records, MCP tools, or the labor loop).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; cross-vendor review still owed on the 10 direct-to-main commits through 053ecd56. No mainnet. Ryan signs merges.

## 2026-11-02 1:40 PM PT protocol sweep (no changes)
- Read: main still at 053ecd56 (2026-09-22); no open PRs; claude/* and preprod/work-auction-labor-loop branch tips unchanged; no hq handoffs commits since the 10:40 AM PT sweep; open co:ul hq issues (#2, #6, #7, #19, #27, #33) have no new protocol, identity, or chain notes.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: labor loop still not live (no preprod bid-escrow-pay tx hashes); only documented mint is one Basic pNFT, which cannot transact; the 10 direct commits on main after 7e08ae7 still need cross-vendor review; no mainnet.

## 2026-11-02 4:35 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no issue/comment activity since the 1:40 PM PT sweep; other branches unchanged (latest non-bot commit preprod/work-auction-labor-loop 49786227, 2026-08-28). hq: no commits or co:ul issue updates since 1:40 PM PT (last handoffs commit 966274b4, 2026-10-28).
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: unchanged. Labor loop not live, no preprod bid-escrow-pay tx hashes; Basic cannot transact; 053ecd56-era chain changes still lack cross-vendor review; Ryan signs merges; no mainnet.

### 2026-11-03 10:35 AM PT sweep
- Read: main still 053ecd56 (2026-09-22); no open PRs; no new commits on claude/*, preprod/work-auction-labor-loop, or this branch beyond prior sweep notes; no new hq commits since last sweep; open co:ul hq issues (#2, #6, #7, #19, #27, #33) not updated since last sweep and none addressed to protocol.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: labor loop still not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; post-7e08ae7 direct commits on main still lack cross-vendor review; no mainnet.

### 2026-11-03 1:35 PM PT sweep
- Read: main still 053ecd56 (2026-09-22); no open PRs; claude/*, preprod/work-auction-labor-loop tips unchanged; no repo issues or comments since the 10:35 AM PT sweep. hq: new comments today only on #12, #14, #15, #20, #23, #25 (MB, PSI, and Cofounder desk lanes), none about protocol; open co:ul issues (#2, #6, #7, #19, #27, #33) not updated since last sweep.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: labor loop still not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; post-7e08ae7 direct commits on main still lack cross-vendor review; no mainnet. Ryan signs merges.

### 2026-11-03 4:37 PM PT sweep
- Read: main still 053ecd56 (2026-09-22); no open PRs; claude/*, preprod/work-auction-labor-loop tips unchanged; no repo issue comments since the 1:35 PM PT sweep. hq: no handoffs commits since 1:35 PM PT; open co:ul issues (#2, #6, #7, #19, #27, #33) not updated since last sweep and none addressed to protocol.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: labor loop still not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; post-7e08ae7 direct commits on main still lack cross-vendor review; no mainnet. Ryan signs merges.

### 2026-11-04 1:31 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no issues updated; other branches (claude/*, preprod/work-auction-labor-loop) unchanged since last sweep. hq: no new commits or co:ul issue updates since 2026-11-04 10:00 AM PT.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: labor loop still not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; cross-vendor review still owed on the 10 direct commits that landed on main after 7e08ae7.

### 2026-11-04 4:39 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still 053ecd56 (2026-09-22); no open PRs; no issues updated; claude/* and preprod/work-auction-labor-loop tips unchanged. hq: no handoffs commits and no open co:ul issue updates since the 1:31 PM PT sweep.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending: labor loop still not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; cross-vendor review still owed on the 10 direct commits on main after 7e08ae7; no mainnet. Ryan signs merges.

## 2026-11-05 10:30 AM PT sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22); no open PRs; no issues updated since last sweep; other branches unchanged (preprod/work-auction-labor-loop 49786227, claude/* last touched 2026-04-29 or earlier). hq: no handoffs/ commits since 2026-11-04; open co:ul issues (#2, #6, #7, #19, #27, #33) have no new protocol/identity/chain notes.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; only Basic pNFT mint documented in docs/TESTNET_STATUS.md; the 10 direct commits on main after 7e08ae7 (work_auction/records/isotope/crystal_tag) still lack cross-vendor review. No mainnet. Ads off.

## 2026-11-05 1:30 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22); no open PRs; no issues updated since the 10:30 AM PT sweep; other branches unchanged (preprod/work-auction-labor-loop 49786227, claude/* last touched 2026-04-29 or earlier). hq: no commits since 2026-11-04; no handoffs/ commits since 966274b4 (2026-10-28); open co:ul issues (#2, #6, #7, #19, #27, #33) have no new protocol/identity/chain notes.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; only Basic pNFT mint documented in docs/TESTNET_STATUS.md; the 10 direct commits on main after 7e08ae7 (work_auction/records/isotope/crystal_tag) still lack cross-vendor review. No mainnet. Ads off.

## 2026-11-05 4:35 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22, "Bind the creator's pNFT to a tag they issue."); compare 053ecd56...main identical (ahead_by 0). No open PRs. No issues updated since the 1:30 PM PT sweep (only closed #16 from 2026-10-28). Other branches unchanged: preprod/work-auction-labor-loop 49786227 (2026-08-28), claude/* last touched 2026-04-29 or earlier. docs/TESTNET_STATUS.md on main re-verified: Cardano preprod; only documented mint is Basic pNFT `pnft_ml361rj3_dcb6eb37787234c8` tx `959f5ba6…fe51d` (2026-02-01); agents do not sign.
- hq: no commits since 2026-11-04; no handoffs/ commits since 966274b4 (2026-10-28); open co:ul issues (#2, #6, #7, #19, #27, #33) have no new protocol/identity/chain notes (Trades ops / deposit / Railway rotation / warranty / COO spec). Search for work_auction / pNFT / labor-loop peer notes: none new.
- Replied to: nothing (no peer notes addressed to protocol, work_auction, pNFT, records, MCP tools, or the labor loop since the 1:30 PM PT sweep).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; only Basic pNFT mint documented; Basic cannot transact; the 10 direct commits on main after 7e08ae7 (work_auction/records/isotope/crystal_tag) still lack cross-vendor review; Gummiworm L2 row remains on this branch only. No mainnet. Ads off. Ryan signs merges.

## 2026-11-06 10:32 AM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22, "Bind the creator's pNFT to a tag they issue."); compare 053ecd56...main identical (ahead_by 0, behind_by 0). No open PRs. No open issues. Other branches unchanged: grok-bot/ul-protocol tip was acc1e2fe; preprod/work-auction-labor-loop 49786227 (2026-08-28); claude/* last touched 2026-04-29 or earlier. docs/TESTNET_STATUS.md on main re-verified: Cardano preprod only; only documented mint is Basic pNFT `pnft_ml361rj3_dcb6eb37787234c8` tx `959f5ba6…fe51d` (2026-02-01); agents do not sign; last verified 2026-09-18.
- hq: no handoffs/ commits since 966274b4 / handoffs/2026-10-28-ul-cos-sync.md; no handoffs commits since 2026-11-05. Open co:ul issues (#2, #6, #7, #19, #27, #33) remain Trades ops / deposit / Railway rotation / warranty / COO / CSO — none ask about work_auction, pNFT, records, MCP, or the labor loop. hq#2 got an UL HR Labor sweep comment today (~10:35 AM PT) restating secrets-gate; not a protocol ask.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; only Basic pNFT mint documented; Basic cannot transact; the 10 direct commits on main after 7e08ae7 (work_auction/records/isotope/crystal_tag) still lack cross-vendor review; Gummiworm L2 row remains on this branch only. No mainnet. Ads off. Ryan signs merges.

## 2026-11-06 1:34 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22, "Bind the creator's pNFT to a tag they issue."); compare main...grok-bot/ul-protocol ahead_by 34 / behind_by 0 (NOTES.md + docs/L2_SCALING_MENU.md only). No open PRs. No open issues. Other branches unchanged: preprod/work-auction-labor-loop 49786227 (2026-08-28); claude/* last touched 2026-04-29 or earlier. docs/TESTNET_STATUS.md on main re-verified: Cardano preprod only; only documented mint is Basic pNFT `pnft_ml361rj3_dcb6eb37787234c8` tx `959f5ba6…fe51d` (2026-02-01); agents do not sign; last verified 2026-09-18.
- hq: no commits since the 10:32 AM PT sweep; no handoffs/ commits since 966274b4 / handoffs/2026-10-28-ul-cos-sync.md. Open co:ul issues (#2, #6, #7, #19, #27, #33) remain Trades ops / deposit / Railway rotation / warranty / COO / CSO — none ask about work_auction, pNFT, records, MCP, or the labor loop. hq#2 still carries the morning UL HR Labor secrets-gate comment; not a protocol ask.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; only Basic pNFT mint documented; Basic cannot transact; the 10 direct commits on main after 7e08ae7 (work_auction/records/isotope/crystal_tag) still lack cross-vendor review; Gummiworm L2 row remains on this branch only. No mainnet. Ads off. Ryan signs merges.

## 2026-11-06 4:36 PM PT protocol sweep (no changes)
- Read: ultralife-protocol main still at 053ecd56 (2026-09-22, "Bind the creator's pNFT to a tag they issue."); compare main...grok-bot/ul-protocol ahead_by NOTES-only commits / behind_by 0. No open PRs. No open issues. Other branches unchanged: preprod/work-auction-labor-loop 49786227 (2026-08-28); claude/* last touched 2026-04-29 or earlier. docs/TESTNET_STATUS.md on main re-verified: Cardano preprod only; only documented mint is Basic pNFT `pnft_ml361rj3_dcb6eb37787234c8` tx `959f5ba6…fe51d` (2026-02-01); agents do not sign; last verified 2026-09-18.
- hq: no handoffs/ commits since 966274b4 / handoffs/2026-10-28-ul-cos-sync.md. Open co:ul issues (#2, #6, #7, #19, #27, #33) remain Trades ops / deposit / Railway rotation / warranty / COO / CSO — none ask about work_auction, pNFT, records, MCP, or the labor loop. hq#2 got an UL HR Labor ~4:31 PM PT secrets-gate restatement; not a protocol ask.
- Replied to: nothing (no peer notes addressed to protocol).
- Pending (unchanged): labor loop not live, no preprod bid-escrow-pay tx hashes; only Basic pNFT mint documented; Basic cannot transact; the 10 direct commits on main after 7e08ae7 (work_auction/records/isotope/crystal_tag) still lack cross-vendor review; Gummiworm L2 row remains on this branch only. No mainnet. Ads off. Ryan signs merges.

## 2026-11-09 10:31 AM PT protocol sweep
- Read: `main` still at `053ecd56` (unchanged since 2026-09-22). New open PR [#17](https://github.com/ryanultralife/ultralife-protocol/pull/17) by ryanultralife, branch `docs/hq66-remove-mb-planning-docs` (`d8433b24`), per [hq#66](https://github.com/ryanultralife/hq/issues/66): deletes five Mechanical Battery planning docs and MB lines in `AGENTS.md`. No validators or protocol code touched. No open issues. hq `handoffs/` unchanged since `966274b4` (2026-10-28); open co:ul issues are Trades/ops only.
- Replied to: nothing. PR #17 is an MB-content removal, not a note to protocol about work_auction, pNFT, records, MCP tools, or the labor loop, and it is outside this lane. No comment posted.
- Observed on PR #17 (FYI, not verified beyond the CI log): CI `build` failed at the "Install Aiken" step (`cargo install aiken v1.1.21` fails to compile against `uplc 1.1.24`), [run 42668269989](https://github.com/ryanultralife/ultralife-protocol/actions/runs/42668269989). This is a toolchain issue, not the doc change; `main` CI has failed since 2026-09-22 too. The PR body has no Tested/CI/Not-verified honesty block. Its body says it leaves links to the removed docs in `README.md`, `llms.txt`, and other docs for Ryan to decide. Ryan merges.
- Pending: labor loop is still not live. TESTNET_STATUS lists only the Basic pNFT mint, there are no preprod bid-escrow-pay tx hashes, and Basic cannot transact. No mainnet.

## 2026-11-09 1:45 PM PT protocol sweep

- Read: `main` still `053ecd56` (unchanged since 2026-09-22). Open PR [#17](https://github.com/ryanultralife/ultralife-protocol/pull/17) got two peer comments since the last sweep: UL Chief of Staff (~11:35 AM PT) asked this seat for a stacked follow-up dropping the links #17 leaves dangling; Holdings Engineering (~1:30 PM PT) noted CI fails at the Aiken install step (pre-existing, `main` red since 2026-09-22) and suggested a workflow fix. No open issues on this repo. hq handoffs unchanged since 2026-10-28; open co:ul hq issues are Trades/ops, not protocol.
- Did: opened [#18](https://github.com/ryanultralife/ultralife-protocol/pull/18) (branch `grok-bot/hq66-drop-dangling-links`, commit `b58872c`, base `docs/hq66-remove-mb-planning-docs`), docs-only, honesty block included. Replied on #17 pointing to #18.
- Pending: CI workflow fix (pin prebuilt Aiken or `cargo install --locked`, fix Cargo.toml path) as its own PR, not started; no green CI baseline exists. Ryan merges #17 then #18.
- Guards: labor loop not live (no preprod bid-escrow-pay tx hashes); Basic cannot transact; no mainnet; nothing deployed.

## 2026-11-09 ~4:35 PM PT sweep (UL Protocol, Grok Bot)
- Read: ultralife-protocol `main` still `053ecd56` (unchanged since 2026-09-22). Open PRs: [#17](https://github.com/ryanultralife/ultralife-protocol/pull/17) (head `d8433b2`, unchanged) and [#18](https://github.com/ryanultralife/ultralife-protocol/pull/18) (head `b58872c`, unchanged). New since 1:45 PM PT: UL Chief of Staff comment on #18 (2026-11-09 ~4:30 PM PT) accepting the minimal diff, setting merge order (#17 first, then #18, retarget to `main` if needed), and noting no CI ran on #18 and `main` has no green baseline. Other branch tips unchanged. No open issues. hq `handoffs/` newest is still `966274b4` (2026-10-28); open `co:ul` issues #2, #6, #7, #19, #27, #33 are Trades/ops, none touch protocol, identity, or chain code.
- Replied to: nothing. The CoS note on #18 closes the ask and asks no question of this seat.
- Pending: CI workflow fix (Aiken install pin, Cargo.toml path) as a separate PR, not yet opened. Ryan merges #17 then #18. Cross-vendor review still owed on direct-to-main chain commits through `053ecd56`. Labor loop not live: no preprod bid-escrow-pay tx hashes; Basic cannot transact; no mainnet.

## 2026-11-10 ~10:30 AM PT sweep (UL Protocol seat)
- Read: main still `053ecd56` (unchanged since 2026-09-22). Open PRs #17 (head `d8433b2`) and #18 (head `b58872c`) unchanged; no new comments since UL Chief of Staff's 2026-11-09 ~4:30 PM PT comment on #18. No open issues in this repo. hq `handoffs/` last commit `966274b4` (2026-10-28); open co:ul issues (#2, #6, #7, #19, #27, #33) are Trades/ops, not protocol.
- Replied to: nothing (no peer note addressed to protocol).
- Pending: separate CI workflow fix PR (Aiken toolchain pin, Cargo.toml path). Merge order #17 then #18; Ryan signs merges.
- Guards: labor loop NOT live (no preprod bid-escrow-pay tx hashes; docs/TESTNET_STATUS.md still shows only a Basic pNFT mint, and Basic cannot transact). No mainnet.

## 2026-11-10 ~1:25 PM PT sweep (UL Protocol seat)
- Read: main still `053ecd56` (unchanged since 2026-09-22). Open PRs #17 (head `d8433b2`) and #18 (head `b58872c`) unchanged, no new comments since the 10:30 AM PT sweep. Other branch tips unchanged. No open issues in this repo. hq `handoffs/` last commit 2026-10-28; open co:ul issues (#2, #6, #7, #19, #27, #33) are Trades/ops, not protocol.
- Replied to: nothing (no peer note addressed to protocol).
- Pending: separate CI workflow fix PR (Aiken toolchain pin, Cargo.toml path). Merge order #17 then #18; Ryan signs merges.
- Guards: labor loop NOT live (no preprod bid-escrow-pay tx hashes; Basic cannot transact). No mainnet.
