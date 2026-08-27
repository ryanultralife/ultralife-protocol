/**
 * PREPROD Mesh path for work-auction.mjs
 * Builds real work_auction spend txs. --unsigned prints CBOR (Ryan signs).
 * Honest BLOCKED if Blockfrost, seed, Standard pNFT, script ref, or factory UTxO is missing.
 */
import crypto from 'crypto';
import { atomicWriteSync, safeReadJson, getCurrentSlot } from './utils.mjs';
import { parseImpactList, expectedCompoundConstr, compoundFlowConstr, decodeWorkAuctionDatum } from './work-auction-datums.mjs';

function bytes(str) {
  return { bytes: Buffer.from(str || '', 'utf8').toString('hex') };
}
function constr(index, fields = []) {
  return { constructor: index, fields };
}
function none() {
  return constr(1, []);
}

const LEVEL_INDEX = { Basic: 0, Ward: 1, Standard: 2, Verified: 3, Steward: 4 };
const LEVEL_NAMES = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];

function encodeLevel(level) {
  return constr(LEVEL_INDEX[level] ?? 2, []);
}

function encodeWorkType(typeName, phaseOrDetail, WORK_TYPES) {
  const t = WORK_TYPES[typeName];
  if (!t) throw new Error(`Unknown work type: ${typeName}`);
  if (typeName === 'construction') {
    const phase = (phaseOrDetail || 'roofing').toLowerCase().replace(/-/g, '_');
    const idx = (t.phases || []).indexOf(phase);
    return constr(0, [constr(idx < 0 ? 3 : idx, [])]);
  }
  if (typeName === 'agriculture') {
    const idx = (t.activities || []).indexOf((phaseOrDetail || 'planting').toLowerCase().replace(/-/g, '_'));
    return constr(1, [constr(idx < 0 ? 0 : idx, [])]);
  }
  if (typeName === 'forestry') {
    const idx = (t.activities || []).indexOf((phaseOrDetail || 'restoration').toLowerCase().replace(/-/g, '_'));
    return constr(2, [constr(idx < 0 ? 0 : idx, [])]);
  }
  const map = { manufacturing: 3, transport: 4, services: 5, maintenance: 6, survey: 7, custom: 8 };
  return constr(map[typeName] ?? 5, [bytes(phaseOrDetail || typeName)]);
}

function requireImpacts(raw, kind) {
  const parsed = parseImpactList(raw);
  if (!parsed.length) {
    throw new Error(kind + ' requires --impact COMPOUND:qty[:unit] (validator list length >= 1). Will not invent CO2/ratings.');
  }
  return parsed;
}
function expectedCompoundList(raw) {
  return { list: requireImpacts(raw, 'CreateRequest').map(expectedCompoundConstr) };
}
function compoundFlowList(raw) {
  return { list: requireImpacts(raw, 'SubmitBid/SubmitWork').map(compoundFlowConstr) };
}

function encodeRequestDatum(f) {
  return constr(0, [constr(0, [
    bytes(f.requestId), bytes(f.requester), bytes(f.asset || ''), bytes(f.bioregion || ''),
    f.workType, bytes(f.specificationsHash || ''), f.expectedImpacts,
    { int: f.budgetMin }, { int: f.budgetMax }, { list: f.requiredCertifications || [] },
    encodeLevel(f.minWorkerLevel), { int: f.bidDeadline }, { int: f.workDeadline },
    { int: f.createdAt }, constr(0, []),
  ])]);
}
function encodeBidDatum(f) {
  return constr(1, [constr(0, [
    bytes(f.bidId), bytes(f.requestId), bytes(f.bidder), { int: f.bidAmount },
    f.estimatedImpacts, { list: f.certifications || [] }, { list: [] }, { int: f.proposedCompletion },
    bytes(f.methodsHash || ''), { int: f.submittedAt }, constr(0, []),
  ])]);
}
function encodeEscrowDatum(f) {
  return constr(2, [constr(0, [
    bytes(f.escrowId), bytes(f.requestId), bytes(f.bidId), bytes(f.requester),
    bytes(f.worker), bytes(f.asset || ''), f.workType, { int: f.amount },
    f.expectedImpacts, { int: f.deadline }, constr(0, []), [], [], [],
  ])]);
}
function encodeCreateRequestRedeemer(f) {
  return constr(0, [
    f.workType, bytes(f.specificationsHash || ''), f.expectedImpacts,
    { int: f.budgetMin }, { int: f.budgetMax }, { list: f.requiredCertifications || [] },
    { int: f.bidDeadline }, { int: f.workDeadline }, { list: [] }, { list: [] },
  ]);
}
function encodeSubmitBidRedeemer(f) {
  return constr(3, [bytes(f.requestId), { int: f.bidAmount }, f.estimatedImpacts, { int: f.proposedCompletion }, bytes(f.methodsHash || '')]);
}
function encodeAcceptBidRedeemer(bidId) { return constr(5, [bytes(bidId), none()]); }
function encodeStartWorkRedeemer(id) { return constr(7, [bytes(id)]); }
function encodeSubmitWorkRedeemer(f) { return constr(8, [bytes(f.escrowId), bytes(f.evidenceHash), f.actualImpacts]); }
function encodeReleasePaymentRedeemer(id) { return constr(10, [bytes(id)]); }

function blocked(log, missing, extra = {}) {
  const report = {
    status: 'BLOCKED',
    network: process.env.NETWORK || 'preprod',
    missing,
    can_transact: 'level != Basic',
    min_level_to_post_or_bid: 'Standard (Ward can_transact is true in types.ak but work_auction comments say Standard+)',
    no_fake_dna: true,
    no_mainnet: true,
    llm_cannot_sign: true,
    genesis_founder_self_verify: 'Real preprod path in validators/genesis.ak FounderSelfVerify: founding oracle key + owned Basic pNFT + unique dna_hash while genesis_active. Do not invent DNA. Ryan signs.',
    ...extra,
  };
  log.error(`[BLOCKED] ${missing}`);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

function resolveWorkAuction(deployment) {
  const refs = deployment.references || deployment.referenceScripts || {};
  const ref = refs.work_auction_work_auction_spend || refs.work_auction || refs.workAuction || null;
  const addresses = deployment.addresses || {};
  const address = addresses.work_auction || addresses.workAuction || ref?.address || process.env.WORK_AUCTION || null;
  const pnftPolicy = deployment.policyIds?.pnft || refs.pnft_pnft_policy_mint?.scriptHash || process.env.PNFT_POLICY || null;
  const tokenPolicy = deployment.policyIds?.token || process.env.TOKEN_POLICY || null;
  const tokenName = deployment.tokenName || process.env.TOKEN_NAME || '';
  return { ref, address, pnftPolicy, tokenPolicy, tokenName };
}

function parseConstrIndex(field) {
  if (field && typeof field.constructor === 'number') return field.constructor;
  return null;
}
function parseBytesUtf8(field) {
  if (!field?.bytes) return null;
  try { return Buffer.from(field.bytes, 'hex').toString('utf8'); } catch { return field.bytes; }
}
function parsePnftFromDatum(plutusData) {
  if (!plutusData) return { level: null, pnftId: null };
  let d = plutusData;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return { level: null, pnftId: null }; } }
  const fields = d.fields || [];
  const li = parseConstrIndex(fields[2]);
  return { level: li === null ? null : LEVEL_NAMES[li], pnftId: parseBytesUtf8(fields[0]) };
}

function findPnftOnUtxos(utxos, pnftPolicy) {
  if (!pnftPolicy) return null;
  for (const u of utxos) {
    const amounts = u.output?.amount || [];
    const asset = amounts.find((a) => a.unit && a.unit.startsWith(pnftPolicy) && a.unit !== 'lovelace' && String(a.quantity) === '1');
    if (!asset) continue;
    const datum = u.output?.plutusData || u.output?.inlineDatum || null;
    const parsed = parsePnftFromDatum(datum);
    return {
      utxo: u,
      unit: asset.unit,
      pnftId: parsed.pnftId || asset.unit.slice(pnftPolicy.length),
      level: parsed.level || 'Basic',
      policyId: pnftPolicy,
    };
  }
  return null;
}

function pickCleanUtxo(utxos, minLovelace = 5_000_000n) {
  const clean = utxos.filter((u) => {
    const hasRef = u.output?.scriptRef || u.output?.plutusData;
    const hasOther = (u.output?.amount || []).some((a) => a.unit !== 'lovelace');
    return !hasRef && !hasOther;
  });
  const pool = clean.length ? clean : utxos;
  return pool.find((u) => {
    const l = (u.output?.amount || []).find((a) => a.unit === 'lovelace');
    return BigInt(l?.quantity || 0) >= minLovelace;
  }) || null;
}

async function submitOrExport({ txBuilder, wallet, provider, unsigned, action, log }) {
  log.info('Completing transaction...');
  const unsignedTx = await txBuilder.complete();
  if (unsigned) {
    const cbor = typeof unsignedTx === 'string' ? unsignedTx : String(unsignedTx);
    log.warn('UNSIGNED — LLM/MCP cannot sign. Ryan must sign and submit on preprod.');
    console.log(JSON.stringify({ status: 'UNSIGNED', action, cbor, next: 'Ryan signs with preprod wallet and submits.' }, null, 2));
    return { unsigned: true, cbor };
  }
  if (!wallet) {
    log.warn('UNSIGNED — no seed. Ryan must sign.');
    console.log(JSON.stringify({ status: 'UNSIGNED', action, cbor: typeof unsignedTx === 'string' ? unsignedTx : String(unsignedTx) }, null, 2));
    return { unsigned: true, cbor: String(unsignedTx) };
  }
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await provider.submitTx(signedTx);
  log.success(`Submitted: ${txHash}`);
  console.log(`https://preprod.cardanoscan.io/transaction/${txHash}`);
  return { txHash };
}

async function spendFactory({ txBuilder, factoryUtxo, ref, scriptAddress, datum, redeemer, extraValue = [] }) {
  txBuilder.spendingPlutusScriptV3();
  txBuilder.txIn(factoryUtxo.input.txHash, factoryUtxo.input.outputIndex, factoryUtxo.output.amount, factoryUtxo.output.address);
  if (factoryUtxo.output?.plutusData || factoryUtxo.output?.inlineDatum) {
    txBuilder.txInInlineDatumPresent();
  } else {
    txBuilder.txInInlineDatumValue(constr(0, []), 'JSON');
  }
  txBuilder.txInRedeemerValue(redeemer, 'JSON');
  if (ref?.txHash) txBuilder.spendingTxInReference(ref.txHash, ref.outputIndex ?? 0);
  txBuilder.txOut(scriptAddress, [{ unit: 'lovelace', quantity: '2000000' }]);
  txBuilder.txOutInlineDatumValue(constr(0, []), 'JSON');
  txBuilder.txOut(scriptAddress, [{ unit: 'lovelace', quantity: '2000000' }, ...extraValue]);
  txBuilder.txOutInlineDatumValue(datum, 'JSON');
}

export async function runChain(ctx) {
  const { getArg, hasFlag, CONFIG, log, WORK_TYPES, REQUEST_STATUS, BID_STATUS, ESCROW_STATUS, canTransact, meetsLevelRequirement } = ctx;
  const unsigned = hasFlag('--unsigned');
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.workAuction = deployment.workAuction || { requests: [], bids: [], escrows: [], chainIndex: [] };

  if (hasFlag('--list-types')) return;
  if (hasFlag('--list-jobs') || hasFlag('--list') || hasFlag('--show') || hasFlag('--list-bids') || hasFlag('--my-jobs')) {
    if (!CONFIG.blockfrostKey) {
      blocked(log, 'BLOCKFROST_API_KEY required to list on-chain jobs. Live path does not read deployment.json listings.');
      process.exit(1);
    }
    const resolvedEarly = resolveWorkAuction(deployment);
    if (!resolvedEarly.address) {
      blocked(log, 'work_auction script address missing; cannot query RequestDatum UTxOs. Not falling back to local JSON.');
      process.exit(1);
    }
    const { BlockfrostProvider, deserializeDatum } = await import('@meshsdk/core');
    const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
    const utxos = await provider.fetchAddressUTxOs(resolvedEarly.address);
    const decoded = [];
    for (const u of utxos) {
      if (!u.output?.plutusData) continue;
      let raw;
      try { raw = deserializeDatum(u.output.plutusData); } catch { continue; }
      const d = decodeWorkAuctionDatum(raw);
      if (d) decoded.push({ utxo: `${u.input.txHash}#${u.input.outputIndex}`, ...d, txHash: u.input.txHash, outputIndex: u.input.outputIndex });
    }
    const want = hasFlag('--list-bids') ? 'bid' : hasFlag('--show') ? null : 'request';
    const jobId = getArg('--show') || getArg('--job');
    let rows = decoded;
    if (hasFlag('--list-bids')) rows = decoded.filter((r) => r.kind === 'bid' && (!jobId || r.requestId === jobId));
    else if (hasFlag('--show')) rows = decoded.filter((r) => jobId && (r.requestId === jobId || r.bidId === jobId || r.escrowId === jobId || r.utxo === jobId));
    else rows = decoded.filter((r) => r.kind === 'request');
    if (!rows.length) {
      log.warn('No matching work_auction datums at script address. Live path does not list simulated JSON jobs.');
      const submitted = (deployment.workAuction.chainIndex || []).filter((e) => e.txHash);
      if (submitted.length) {
        log.info('Submitted tx hashes only (not a job catalog):');
        for (const e of submitted) console.log(`  ${e.action} ${e.txHash}`);
      }
    } else {
      console.log(JSON.stringify(rows, null, 2));
    }
    return;
  }

  const missing = [];
  if (!CONFIG.blockfrostKey || String(CONFIG.blockfrostKey).includes('your_blockfrost')) {
    missing.push('BLOCKFROST_API_KEY (preprod project)');
  }
  if (!CONFIG.walletMnemonic || String(CONFIG.walletMnemonic).includes('your twenty')) {
    if (unsigned && process.env.WALLET_ADDRESS) {
      log.warn('No WALLET_SEED_PHRASE; --unsigned with WALLET_ADDRESS. Will print CBOR, not submit.');
    } else {
      missing.push('WALLET_SEED_PHRASE (or --unsigned plus WALLET_ADDRESS). LLM cannot sign. No fake success.');
    }
  }
  const resolved = resolveWorkAuction(deployment);
  if (!resolved.address || String(resolved.address).includes('TODO')) {
    missing.push('work_auction script address (deployment.addresses.work_auction or WORK_AUCTION)');
  }
  if (!resolved.ref?.txHash) {
    missing.push('work_auction reference script (deployment.references.work_auction_work_auction_spend)');
  }
  if (!resolved.pnftPolicy || String(resolved.pnftPolicy).startsWith('TODO')) {
    missing.push('pNFT policy id (deployment.policyIds.pnft / PNFT_POLICY)');
  }
  if (missing.length) {
    blocked(log, missing.join('; '), resolved);
    process.exit(1);
  }

  const { BlockfrostProvider, MeshWallet, MeshTxBuilder, deserializeAddress } = await import('@meshsdk/core');
  const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
  let wallet = null;
  let address = process.env.WALLET_ADDRESS || null;
  if (CONFIG.walletMnemonic && !String(CONFIG.walletMnemonic).includes('your twenty')) {
    wallet = new MeshWallet({
      networkId: 0,
      fetcher: provider,
      submitter: provider,
      key: { type: 'mnemonic', words: CONFIG.walletMnemonic.trim().split(/\s+/) },
    });
    address = await Promise.resolve(wallet.getChangeAddress());
  }
  if (!address) {
    blocked(log, 'No wallet address. Set WALLET_SEED_PHRASE or WALLET_ADDRESS.');
    process.exit(1);
  }
  log.info(`Wallet: ${address}`);
  const utxos = await provider.fetchAddressUTxOs(address);
  const pnft = findPnftOnUtxos(utxos, resolved.pnftPolicy);
  if (!pnft) {
    blocked(log, 'No pNFT UTxO under deployed policy. Mint Basic then upgrade via genesis FounderSelfVerify with real DNA (Ryan-signed). Do not mint Standard with fake DNA.', { address, pnftPolicy: resolved.pnftPolicy });
    process.exit(1);
  }
  log.info(`pNFT ${pnft.pnftId} level=${pnft.level}`);
  if (!canTransact(pnft.level)) {
    blocked(log, `pNFT level ${pnft.level} cannot transact (can_transact requires level != Basic). Crew job needs Standard+. FounderSelfVerify requires Ryan-signed unique DNA — this agent will not invent a hash.`, { pnftId: pnft.pnftId, level: pnft.level });
    process.exit(1);
  }

  const inputUtxo = pickCleanUtxo(utxos);
  if (!inputUtxo) {
    blocked(log, 'No clean 5 ADA UTxO for fees/collateral');
    process.exit(1);
  }
  const scriptUtxos = await provider.fetchAddressUTxOs(resolved.address).catch(() => []);
  const factoryUtxo = scriptUtxos[0] || null;
  const needsFactory = hasFlag('--post-job') || hasFlag('--post') || hasFlag('--bid') || hasFlag('--accept-bid') || hasFlag('--accept') || hasFlag('--start') || hasFlag('--complete') || hasFlag('--confirm');
  if (!factoryUtxo && needsFactory) {
    blocked(log, 'work_auction factory UTxO missing — Ryan must bootstrap a 2 ADA UTxO at the work_auction script address so spend redeemers can run', { scriptAddress: resolved.address });
    process.exit(1);
  }

  const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider, verbose: false });
  txBuilder.txIn(inputUtxo.input.txHash, inputUtxo.input.outputIndex, inputUtxo.output.amount, inputUtxo.output.address);
  txBuilder.changeAddress(address);
  txBuilder.txInCollateral(inputUtxo.input.txHash, inputUtxo.input.outputIndex, inputUtxo.output.amount, inputUtxo.output.address);
  txBuilder.readOnlyTxInReference(pnft.utxo.input.txHash, pnft.utxo.input.outputIndex);
  txBuilder.requiredSignerHash(deserializeAddress(address).pubKeyHash);
  const slot = await getCurrentSlot(provider, CONFIG.network);
  txBuilder.invalidBefore(slot);
  txBuilder.invalidHereafter(slot + 7200);

  const record = (event) => {
    deployment.workAuction.chainIndex = deployment.workAuction.chainIndex || [];
    deployment.workAuction.chainIndex.push(event);
    atomicWriteSync(CONFIG.deploymentPath, deployment);
  };

  if (hasFlag('--post-job') || hasFlag('--post')) {
    const description = getArg('--desc') || getArg('--description');
    if (!description) { log.error('--desc required'); process.exit(1); }
    const workTypeName = (getArg('--type') || 'construction').toLowerCase();
    const phase = getArg('--phase') || 'roofing';
    const budgetMin = parseInt(getArg('--budget-min') || getArg('--min') || '50', 10);
    const budgetMax = parseInt(getArg('--budget-max') || getArg('--max') || '100', 10);
    const minLevel = getArg('--min-level') || 'Standard';
    const workType = encodeWorkType(workTypeName, phase, WORK_TYPES);
    const requestId = `job_${crypto.randomBytes(8).toString('hex')}`;
    const bidDeadline = slot + parseInt(getArg('--bid-deadline') || '7', 10) * 86400;
    const workDeadline = slot + parseInt(getArg('--work-deadline') || '30', 10) * 86400;
    const expectedImpacts = expectedCompoundList(getArg('--impact') || getArg('--impacts'));
    const certs = (getArg('--skills') || '').split(',').filter(Boolean).map((s) => bytes(s.trim()));
    const datum = encodeRequestDatum({
      requestId, requester: pnft.pnftId, asset: getArg('--asset') || '', bioregion: getArg('--bioregion') || '',
      workType, specificationsHash: getArg('--specs') || description, expectedImpacts,
      budgetMin, budgetMax, requiredCertifications: certs, minWorkerLevel: minLevel,
      bidDeadline, workDeadline, createdAt: slot,
    });
    const redeemer = encodeCreateRequestRedeemer({
      workType, specificationsHash: getArg('--specs') || description, expectedImpacts,
      budgetMin, budgetMax, requiredCertifications: certs, bidDeadline, workDeadline,
    });
    await spendFactory({ txBuilder, factoryUtxo, ref: resolved.ref, scriptAddress: resolved.address, datum, redeemer });
    const result = await submitOrExport({ txBuilder, wallet, provider, unsigned, action: 'CreateRequest', log });
    const row = {
      requestId, requester: pnft.pnftId, requesterAddress: address, workType: workTypeName, phase, description,
      budgetMin, budgetMax, minWorkerLevel: minLevel, bidDeadline, workDeadline,
      status: REQUEST_STATUS.OPEN, mode: unsigned ? 'unsigned' : 'preprod', txHash: result.txHash || null,
    };
    deployment.workAuction.requests.push(row);
    record({ action: 'CreateRequest', ...row, explorer: result.txHash ? `https://preprod.cardanoscan.io/transaction/${result.txHash}` : null });
    return;
  }

  if (hasFlag('--bid')) {
    const jobId = getArg('--job');
    const request = (deployment.workAuction.requests || []).find((r) => r.requestId === jobId);
    if (!request) { log.error('--job id not in chain index'); process.exit(1); }
    if (request.requester === pnft.pnftId) { log.error('Cannot bid on own job'); process.exit(1); }
    if (!meetsLevelRequirement(pnft.level, request.minWorkerLevel || 'Standard')) {
      blocked(log, `Bidder ${pnft.level} does not meet min_worker_level ${request.minWorkerLevel}`);
      process.exit(1);
    }
    const bidAmount = parseInt(getArg('--amount') || '0', 10);
    const bidId = `bid_${crypto.randomBytes(8).toString('hex')}`;
    const proposedCompletion = slot + parseInt(getArg('--timeline') || '14', 10) * 86400;
    const estimatedImpacts = compoundFlowList(getArg('--impact') || getArg('--impacts'));
    const datum = encodeBidDatum({
      bidId, requestId: jobId, bidder: pnft.pnftId, bidAmount, estimatedImpacts,
      certifications: [], proposedCompletion, methodsHash: getArg('--methods') || '', submittedAt: slot,
    });
    const redeemer = encodeSubmitBidRedeemer({ requestId: jobId, bidAmount, estimatedImpacts, proposedCompletion, methodsHash: getArg('--methods') || '' });
    if (request.txHash) txBuilder.readOnlyTxInReference(request.txHash, request.outputIndex ?? 0);
    await spendFactory({ txBuilder, factoryUtxo, ref: resolved.ref, scriptAddress: resolved.address, datum, redeemer });
    const result = await submitOrExport({ txBuilder, wallet, provider, unsigned, action: 'SubmitBid', log });
    const bid = { bidId, requestId: jobId, bidder: pnft.pnftId, bidderAddress: address, bidAmount, status: BID_STATUS.PENDING, mode: unsigned ? 'unsigned' : 'preprod', txHash: result.txHash || null };
    deployment.workAuction.bids.push(bid);
    record({ action: 'SubmitBid', ...bid });
    return;
  }

  if (hasFlag('--accept-bid') || hasFlag('--accept')) {
    const bidId = getArg('--bid');
    const bid = (deployment.workAuction.bids || []).find((b) => b.bidId === bidId);
    const request = bid && (deployment.workAuction.requests || []).find((r) => r.requestId === bid.requestId);
    if (!bid || !request) { log.error('bid/job not in chain index'); process.exit(1); }
    if (request.requester !== pnft.pnftId) { log.error('Only requester can accept'); process.exit(1); }
    const escrowId = `escrow_${crypto.randomBytes(8).toString('hex')}`;
    const workType = encodeWorkType(request.workType || 'construction', request.phase || 'roofing', WORK_TYPES);
    const extraValue = resolved.tokenPolicy ? [{ unit: resolved.tokenPolicy + (resolved.tokenName || ''), quantity: String(bid.bidAmount) }] : [];
    const datum = encodeEscrowDatum({
      escrowId, requestId: request.requestId, bidId, requester: request.requester, worker: bid.bidder,
      asset: request.asset || '', workType, amount: bid.bidAmount, expectedImpacts: { list: [] }, deadline: request.workDeadline,
    });
    await spendFactory({ txBuilder, factoryUtxo, ref: resolved.ref, scriptAddress: resolved.address, datum, redeemer: encodeAcceptBidRedeemer(bidId), extraValue });
    const result = await submitOrExport({ txBuilder, wallet, provider, unsigned, action: 'AcceptBid', log });
    bid.status = BID_STATUS.ACCEPTED;
    request.status = REQUEST_STATUS.IN_PROGRESS;
    request.worker = bid.bidder;
    deployment.workAuction.escrows.push({ escrowId, requestId: request.requestId, bidId, amount: bid.bidAmount, status: ESCROW_STATUS.FUNDED, worker: bid.bidder, requester: request.requester, mode: unsigned ? 'unsigned' : 'preprod', txHash: result.txHash || null });
    record({ action: 'AcceptBid', escrowId, bidId, txHash: result.txHash || null });
    return;
  }

  if (hasFlag('--start') || hasFlag('--complete') || hasFlag('--confirm')) {
    const jobId = getArg('--job');
    const request = (deployment.workAuction.requests || []).find((r) => r.requestId === jobId);
    const escrow = (deployment.workAuction.escrows || []).find((e) => e.requestId === jobId);
    if (!request || !escrow) { log.error('job/escrow not in chain index'); process.exit(1); }
    let action = 'StartWork';
    let redeemer = encodeStartWorkRedeemer(escrow.escrowId);
    if (hasFlag('--complete')) {
      action = 'SubmitWork';
      const evidenceHash = getArg('--evidence');
      if (!evidenceHash) { log.error('Provide --evidence <hash>. Will not invent a demo hash.'); process.exit(1); }
      redeemer = encodeSubmitWorkRedeemer({ escrowId: escrow.escrowId, evidenceHash, actualImpacts: compoundFlowList(getArg('--impact') || getArg('--impacts')) });
    } else if (hasFlag('--confirm')) {
      action = 'ReleasePayment';
      redeemer = encodeReleasePaymentRedeemer(escrow.escrowId);
    }
    const datum = encodeEscrowDatum({
      escrowId: escrow.escrowId, requestId: request.requestId, bidId: escrow.bidId,
      requester: request.requester, worker: request.worker, asset: request.asset || '',
      workType: encodeWorkType(request.workType || 'construction', request.phase || 'roofing', WORK_TYPES),
      amount: escrow.amount, expectedImpacts: { list: [] }, deadline: request.workDeadline,
    });
    await spendFactory({ txBuilder, factoryUtxo, ref: resolved.ref, scriptAddress: resolved.address, datum, redeemer });
    const result = await submitOrExport({ txBuilder, wallet, provider, unsigned, action, log });
    if (action === 'StartWork') escrow.status = ESCROW_STATUS.WORK_STARTED;
    if (action === 'SubmitWork') { escrow.status = ESCROW_STATUS.WORK_SUBMITTED; request.status = REQUEST_STATUS.PENDING_VERIFICATION; }
    if (action === 'ReleasePayment') { escrow.status = ESCROW_STATUS.RELEASED; request.status = REQUEST_STATUS.COMPLETED; }
    record({ action, jobId, txHash: result.txHash || null, explorer: result.txHash ? `https://preprod.cardanoscan.io/transaction/${result.txHash}` : null });
    return;
  }

  log.error('No chain command matched. Use --post-job / --bid / --accept-bid / --start / --complete / --confirm or --simulate.');
}
