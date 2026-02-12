#!/usr/bin/env node
/**
 * UltraLife Protocol — Care Economy CLI
 *
 * Care work is the foundation that enables all other economic activity.
 * This script manages the care economy: registering needs, fulfilling care,
 * tracking outcomes, and earning care credits.
 *
 * Usage:
 *   node care.mjs --register-need --type eldercare --hours 4 --desc "Help with weekly shopping"
 *   node care.mjs --list-needs --bioregion sierra_nevada
 *   node care.mjs --fulfill --need <id>
 *   node care.mjs --accept --offer <id>
 *   node care.mjs --track --care <id> --note "Session completed, good progress"
 *   node care.mjs --complete --care <id>
 *   node care.mjs --my-care
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Fix libsodium ESM
function fixLibsodiumESM() {
  const nodeModules = path.join(__dirname, 'node_modules');
  const targetDir = path.join(nodeModules, 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm');
  const targetFile = path.join(targetDir, 'libsodium-sumo.mjs');
  const sourceFile = path.join(nodeModules, 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs');
  if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
    try { fs.copyFileSync(sourceFile, targetFile); } catch (err) {}
  }
}
fixLibsodiumESM();

const log = {
  info: (msg) => console.log(`[INFO]  ${msg}`),
  success: (msg) => console.log(`[OK]    ${msg}`),
  warn: (msg) => console.log(`[WARN]  ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// =============================================================================
// CARE TYPES (from care.ak validator)
// =============================================================================

const CARE_TYPES = {
  childcare: {
    code: 'CHILDCARE',
    name: 'Childcare',
    description: 'Caring for children (feeding, supervision, education, play)',
    creditsPerHour: 15,
    ageGroups: ['infant', 'toddler', 'preschool', 'school_age', 'adolescent'],
    activities: ['feeding', 'bathing', 'supervision', 'education', 'healthcare', 'transportation', 'emotional_support', 'play'],
  },
  eldercare: {
    code: 'ELDERCARE',
    name: 'Elder Care',
    description: 'Caring for elderly (companionship, meals, medication, mobility)',
    creditsPerHour: 15,
    levels: ['independent', 'assisted', 'full_time', 'medical', 'palliative'],
    activities: ['companionship', 'meal_prep', 'medication', 'mobility', 'personal_care', 'transportation', 'household', 'medical_appts'],
  },
  disability: {
    code: 'DISABILITY',
    name: 'Disability Care',
    description: 'Supporting people with disabilities (physical, cognitive, sensory)',
    creditsPerHour: 18,
    supportTypes: ['physical', 'cognitive', 'sensory', 'mental_health', 'daily_living', 'advocacy'],
  },
  health: {
    code: 'HEALTH',
    name: 'Health Support',
    description: 'Health-related care (post-surgery, chronic condition, recovery)',
    creditsPerHour: 15,
    supportTypes: ['post_surgery', 'chronic_condition', 'mental_health', 'recovery', 'prenatal', 'postnatal'],
  },
  household: {
    code: 'HOUSEHOLD',
    name: 'Household',
    description: 'Household management (cleaning, cooking, shopping, repairs)',
    creditsPerHour: 10,
    activities: ['cleaning', 'cooking', 'laundry', 'shopping', 'budget', 'repairs', 'gardening', 'pet_care'],
  },
  community: {
    code: 'COMMUNITY',
    name: 'Community Service',
    description: 'Community service (volunteering, mutual aid, neighborhood help)',
    creditsPerHour: 12,
    serviceTypes: ['volunteering', 'mutual_aid', 'neighborhood', 'emergency', 'environmental', 'educational', 'cultural', 'religious'],
  },
  family: {
    code: 'FAMILY',
    name: 'Family Support',
    description: 'Family support (emotional support, guidance, mentoring)',
    creditsPerHour: 12,
    supportTypes: ['emotional', 'financial_guidance', 'conflict_resolution', 'crisis', 'mentoring', 'advocacy'],
  },
};

// Care need/record statuses
const CARE_STATUS = {
  NEED_OPEN: 'need_open',           // Need registered, waiting for offers
  OFFER_PENDING: 'offer_pending',   // Offer made, waiting for acceptance
  IN_PROGRESS: 'in_progress',       // Care is being provided
  PENDING_ATTESTATION: 'pending_attestation', // Care complete, needs attestation
  ATTESTED: 'attested',             // Has required attestations
  CREDITED: 'credited',             // Credits claimed
  DISPUTED: 'disputed',             // Under dispute
  CANCELLED: 'cancelled',           // Cancelled
};

// =============================================================================
// HEALTH OUTCOME TRACKING
// =============================================================================

const HEALTH_OUTCOMES = {
  physical: {
    mobility_improved: { name: 'Mobility Improved', weight: 1.2 },
    pain_reduced: { name: 'Pain Reduced', weight: 1.1 },
    strength_increased: { name: 'Strength Increased', weight: 1.1 },
    energy_improved: { name: 'Energy Improved', weight: 1.0 },
  },
  cognitive: {
    clarity_improved: { name: 'Mental Clarity Improved', weight: 1.1 },
    memory_supported: { name: 'Memory Supported', weight: 1.0 },
    engagement_increased: { name: 'Social Engagement Increased', weight: 1.1 },
  },
  emotional: {
    mood_improved: { name: 'Mood Improved', weight: 1.1 },
    anxiety_reduced: { name: 'Anxiety Reduced', weight: 1.2 },
    isolation_reduced: { name: 'Isolation Reduced', weight: 1.2 },
    confidence_increased: { name: 'Confidence Increased', weight: 1.0 },
  },
  practical: {
    independence_maintained: { name: 'Independence Maintained', weight: 1.3 },
    safety_improved: { name: 'Safety Improved', weight: 1.2 },
    nutrition_improved: { name: 'Nutrition Improved', weight: 1.1 },
    hygiene_maintained: { name: 'Hygiene Maintained', weight: 1.0 },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

function getCurrentSlot() {
  // Approximate preprod slot
  return Math.floor(Date.now() / 1000) - 1654041600;
}

function formatTimeAgo(isoDate) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHrs / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHrs > 0) return `${diffHrs}h ago`;
  return 'just now';
}

function calculateCredits(careType, hours, outcomes = []) {
  const typeInfo = CARE_TYPES[careType];
  if (!typeInfo) return hours * 10; // Default

  let baseCredits = hours * typeInfo.creditsPerHour;

  // Apply outcome multipliers
  for (const outcome of outcomes) {
    for (const category of Object.values(HEALTH_OUTCOMES)) {
      if (category[outcome]) {
        baseCredits *= category[outcome].weight;
      }
    }
  }

  return Math.round(baseCredits);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log(`
===============================================================================
        UltraLife Protocol — Care Economy

        Recognizing invisible labor: the work that enables all other work
===============================================================================
`);

  const args = process.argv.slice(2);

  // Command flags
  const registerNeedIdx = args.indexOf('--register-need');
  const listNeedsIdx = args.indexOf('--list-needs');
  const fulfillIdx = args.indexOf('--fulfill');
  const acceptIdx = args.indexOf('--accept');
  const trackIdx = args.indexOf('--track');
  const completeIdx = args.indexOf('--complete');
  const myCareIdx = args.indexOf('--my-care');
  const helpIdx = args.indexOf('--help');
  const listTypesIdx = args.indexOf('--list-types');

  // Parameter flags
  const userIdx = args.indexOf('--user');
  const typeIdx = args.indexOf('--type');
  const hoursIdx = args.indexOf('--hours');
  const descIdx = args.indexOf('--desc');
  const bioregionIdx = args.indexOf('--bioregion');
  const needIdx = args.indexOf('--need');
  const offerIdx = args.indexOf('--offer');
  const careIdx = args.indexOf('--care');
  const noteIdx = args.indexOf('--note');
  const outcomeIdx = args.indexOf('--outcome');
  const recipientIdx = args.indexOf('--recipient');
  const urgentIdx = args.indexOf('--urgent');

  const { atomicWriteSync, safeReadJson } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  // Load deployment state
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.careNeeds = deployment.careNeeds || [];
  deployment.careOffers = deployment.careOffers || [];
  deployment.careRecords = deployment.careRecords || [];
  deployment.careCredits = deployment.careCredits || {};
  deployment.testUsers = deployment.testUsers || [];
  deployment.pnfts = deployment.pnfts || [];

  // Show help
  if (helpIdx >= 0 || args.length === 0) {
    showHelp();
    return;
  }

  // List care types
  if (listTypesIdx >= 0) {
    listCareTypes();
    return;
  }

  // Determine active user
  let userAddress;
  let userName = 'You';
  let userPnft;
  let userBioregion = 'sierra_nevada';

  if (userIdx >= 0) {
    const userArg = args[userIdx + 1];
    const testUser = deployment.testUsers.find(u => u.name.toLowerCase() === userArg?.toLowerCase());
    if (!testUser) {
      log.error(`Test user not found: ${userArg}`);
      log.info('Available users: ' + deployment.testUsers.map(u => u.name).join(', '));
      process.exit(1);
    }
    userAddress = testUser.address;
    userName = testUser.name;
    userPnft = testUser.pnftId;
    userBioregion = testUser.bioregion || 'sierra_nevada';
    log.info(`Acting as: ${userName} (${userBioregion})`);
  } else {
    // Use main wallet
    if (!CONFIG.walletMnemonic) {
      log.error('Missing WALLET_SEED_PHRASE in .env (or use --user <name>)');
      process.exit(1);
    }
    const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
    const wallet = new MeshWallet({
      networkId: CONFIG.network === 'mainnet' ? 1 : 0,
      fetcher: provider,
      submitter: provider,
      key: {
        type: 'mnemonic',
        words: CONFIG.walletMnemonic.trim().split(/\s+/),
      },
    });
    userAddress = wallet.getChangeAddress();
    const pnft = deployment.pnfts.find(p => p.owner === userAddress);
    userPnft = pnft?.id || 'main_pnft';
    userBioregion = pnft?.bioregion || 'sierra_nevada';
  }

  // ==========================================================================
  // COMMAND: --register-need
  // ==========================================================================
  if (registerNeedIdx >= 0) {
    const careType = typeIdx >= 0 ? args[typeIdx + 1]?.toLowerCase() : null;
    const hours = hoursIdx >= 0 ? parseInt(args[hoursIdx + 1]) : 4;
    const description = descIdx >= 0 ? args[descIdx + 1] : '';
    const recipient = recipientIdx >= 0 ? args[recipientIdx + 1] : 'self';
    const isUrgent = urgentIdx >= 0;

    if (!careType || !CARE_TYPES[careType]) {
      log.error('Invalid or missing care type.');
      log.info('Valid types: ' + Object.keys(CARE_TYPES).join(', '));
      log.info('Use --list-types for details.');
      process.exit(1);
    }

    if (isNaN(hours) || hours <= 0 || hours > 168) {
      log.error('Hours must be between 1 and 168 (one week).');
      process.exit(1);
    }

    const needId = generateId('need');
    const careNeed = {
      needId: needId,
      requester: userPnft,
      requesterAddress: userAddress,
      requesterName: userName,
      careType: careType,
      careTypeName: CARE_TYPES[careType].name,
      hours: hours,
      description: description,
      recipient: recipient,
      bioregion: userBioregion,
      urgent: isUrgent,
      status: CARE_STATUS.NEED_OPEN,
      offers: [],
      createdAt: new Date().toISOString(),
      createdSlot: getCurrentSlot(),
      testnetSimulated: true,
    };

    deployment.careNeeds.push(careNeed);
    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
===============================================================================
                     CARE NEED REGISTERED
===============================================================================
  Need ID:      ${needId}
  Type:         ${CARE_TYPES[careType].name}
  Hours:        ${hours}
  Description:  ${description || '(none)'}
  Recipient:    ${recipient}
  Bioregion:    ${userBioregion}
  Urgent:       ${isUrgent ? 'YES' : 'No'}
  Status:       Open for offers
-------------------------------------------------------------------------------
  Estimated credits for caregiver: ${hours * CARE_TYPES[careType].creditsPerHour}
-------------------------------------------------------------------------------

Caregivers in your bioregion can now offer to fulfill this need.
They can run: npm run care:fulfill -- --need ${needId}
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --list-needs
  // ==========================================================================
  if (listNeedsIdx >= 0) {
    const filterBioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;
    const filterType = typeIdx >= 0 ? args[typeIdx + 1]?.toLowerCase() : null;

    let needs = deployment.careNeeds.filter(n => n.status === CARE_STATUS.NEED_OPEN);

    if (filterBioregion) {
      needs = needs.filter(n => n.bioregion === filterBioregion);
    }
    if (filterType) {
      needs = needs.filter(n => n.careType === filterType);
    }

    if (needs.length === 0) {
      log.info('No open care needs found.');
      if (filterBioregion) log.info(`  Bioregion filter: ${filterBioregion}`);
      if (filterType) log.info(`  Type filter: ${filterType}`);
      log.info('');
      log.info('Register a need: npm run care:register -- --type eldercare --hours 4');
      return;
    }

    console.log(`
Care Needs in ${filterBioregion || 'all bioregions'}:

  ID                              TYPE           HOURS   URGENT   REQUESTER       POSTED
  ------------------------------  -------------  -----   ------   ------------    --------`);

    for (const need of needs) {
      const id = need.needId.slice(0, 28) + '...';
      const type = (CARE_TYPES[need.careType]?.name || need.careType).slice(0, 12).padEnd(13);
      const hours = String(need.hours).padEnd(5);
      const urgent = need.urgent ? 'YES   ' : '      ';
      const requester = (need.requesterName || 'Unknown').slice(0, 12).padEnd(12);
      const posted = formatTimeAgo(need.createdAt).padEnd(8);

      console.log(`  ${id}  ${type}  ${hours}   ${urgent}   ${requester}    ${posted}`);
      if (need.description) {
        console.log(`      "${need.description.slice(0, 60)}${need.description.length > 60 ? '...' : ''}"`);
      }
    }

    console.log(`
-------------------------------------------------------------------------------
  Total open needs: ${needs.length}
-------------------------------------------------------------------------------

To offer care: npm run care:fulfill -- --need <id>
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --fulfill (offer to fulfill a care need)
  // ==========================================================================
  if (fulfillIdx >= 0) {
    const needId = needIdx >= 0 ? args[needIdx + 1] : null;
    const note = noteIdx >= 0 ? args[noteIdx + 1] : '';

    if (!needId) {
      log.error('Missing --need <id>');
      log.info('Use --list-needs to see available needs.');
      process.exit(1);
    }

    const need = deployment.careNeeds.find(n => n.needId === needId || n.needId.startsWith(needId));
    if (!need) {
      log.error(`Care need not found: ${needId}`);
      process.exit(1);
    }

    if (need.status !== CARE_STATUS.NEED_OPEN) {
      log.error(`This need is no longer open (status: ${need.status})`);
      process.exit(1);
    }

    if (need.requesterAddress === userAddress) {
      log.error('You cannot offer to fulfill your own care need.');
      process.exit(1);
    }

    // Check if already offered
    const existingOffer = need.offers?.find(o => o.caregiverAddress === userAddress);
    if (existingOffer) {
      log.error('You have already made an offer for this need.');
      process.exit(1);
    }

    const offerId = generateId('offer');
    const offer = {
      offerId: offerId,
      needId: need.needId,
      caregiver: userPnft,
      caregiverAddress: userAddress,
      caregiverName: userName,
      caregiverBioregion: userBioregion,
      note: note,
      status: CARE_STATUS.OFFER_PENDING,
      offeredAt: new Date().toISOString(),
      testnetSimulated: true,
    };

    need.offers = need.offers || [];
    need.offers.push(offer);
    deployment.careOffers.push(offer);
    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
===============================================================================
                     CARE OFFER SUBMITTED
===============================================================================
  Offer ID:     ${offerId}
  Need ID:      ${need.needId}
  Care Type:    ${CARE_TYPES[need.careType]?.name || need.careType}
  Hours:        ${need.hours}
  Requester:    ${need.requesterName}
-------------------------------------------------------------------------------
  Your Note:    ${note || '(none)'}
-------------------------------------------------------------------------------

Waiting for ${need.requesterName} to accept your offer.
Potential credits upon completion: ${need.hours * CARE_TYPES[need.careType].creditsPerHour}
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --accept (accept a care offer)
  // ==========================================================================
  if (acceptIdx >= 0) {
    const offerId = offerIdx >= 0 ? args[offerIdx + 1] : null;

    if (!offerId) {
      // List offers for user's needs
      const myNeeds = deployment.careNeeds.filter(n =>
        n.requesterAddress === userAddress &&
        n.status === CARE_STATUS.NEED_OPEN &&
        n.offers?.length > 0
      );

      if (myNeeds.length === 0) {
        log.info('No pending offers for your care needs.');
        return;
      }

      console.log(`
Pending offers for your care needs:
`);
      for (const need of myNeeds) {
        console.log(`  Need: ${need.needId.slice(0, 30)}... (${CARE_TYPES[need.careType]?.name})`);
        for (const offer of need.offers.filter(o => o.status === CARE_STATUS.OFFER_PENDING)) {
          console.log(`    Offer: ${offer.offerId}`);
          console.log(`      From: ${offer.caregiverName} (${offer.caregiverBioregion})`);
          if (offer.note) console.log(`      Note: "${offer.note}"`);
        }
        console.log('');
      }
      console.log('Accept an offer: npm run care:accept -- --offer <offer_id>');
      return;
    }

    // Find the offer
    const offer = deployment.careOffers.find(o => o.offerId === offerId || o.offerId.startsWith(offerId));
    if (!offer) {
      log.error(`Offer not found: ${offerId}`);
      process.exit(1);
    }

    const need = deployment.careNeeds.find(n => n.needId === offer.needId);
    if (!need) {
      log.error('Associated care need not found.');
      process.exit(1);
    }

    if (need.requesterAddress !== userAddress) {
      log.error('You can only accept offers for your own care needs.');
      process.exit(1);
    }

    if (offer.status !== CARE_STATUS.OFFER_PENDING) {
      log.error(`This offer is no longer pending (status: ${offer.status})`);
      process.exit(1);
    }

    // Create care record
    const recordId = generateId('care');
    const careRecord = {
      recordId: recordId,
      needId: need.needId,
      offerId: offer.offerId,
      caregiver: offer.caregiver,
      caregiverAddress: offer.caregiverAddress,
      caregiverName: offer.caregiverName,
      recipient: need.requester,
      recipientAddress: need.requesterAddress,
      recipientName: need.requesterName,
      careType: need.careType,
      careTypeName: CARE_TYPES[need.careType]?.name,
      hours: need.hours,
      hoursCompleted: 0,
      description: need.description,
      bioregion: need.bioregion,
      status: CARE_STATUS.IN_PROGRESS,
      trackingNotes: [],
      outcomes: [],
      attestations: [],
      creditsEarned: 0,
      startedAt: new Date().toISOString(),
      startedSlot: getCurrentSlot(),
      testnetSimulated: true,
    };

    // Update statuses
    need.status = CARE_STATUS.IN_PROGRESS;
    need.acceptedOfferId = offer.offerId;
    need.careRecordId = recordId;
    offer.status = CARE_STATUS.IN_PROGRESS;
    offer.careRecordId = recordId;

    // Reject other offers
    for (const otherOffer of need.offers.filter(o => o.offerId !== offer.offerId)) {
      otherOffer.status = CARE_STATUS.CANCELLED;
      otherOffer.rejectedAt = new Date().toISOString();
      otherOffer.rejectionReason = 'Another offer was accepted';
    }

    deployment.careRecords.push(careRecord);
    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
===============================================================================
                     CARE OFFER ACCEPTED
===============================================================================
  Care Record ID:  ${recordId}
  Caregiver:       ${offer.caregiverName}
  Care Type:       ${CARE_TYPES[need.careType]?.name}
  Hours:           ${need.hours}
  Status:          IN PROGRESS
-------------------------------------------------------------------------------

Care provision has begun. The caregiver can now track progress:
  npm run care:track -- --care ${recordId} --note "Session notes..."

When complete, either party can mark it complete:
  npm run care:complete -- --care ${recordId}
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --track (track care progress)
  // ==========================================================================
  if (trackIdx >= 0) {
    const careId = careIdx >= 0 ? args[careIdx + 1] : null;
    const note = noteIdx >= 0 ? args[noteIdx + 1] : '';
    const hoursWorked = hoursIdx >= 0 ? parseFloat(args[hoursIdx + 1]) : 0;
    const outcomeArg = outcomeIdx >= 0 ? args[outcomeIdx + 1] : null;

    if (!careId) {
      // List active care records for user
      const myRecords = deployment.careRecords.filter(r =>
        (r.caregiverAddress === userAddress || r.recipientAddress === userAddress) &&
        r.status === CARE_STATUS.IN_PROGRESS
      );

      if (myRecords.length === 0) {
        log.info('No active care records found.');
        return;
      }

      console.log(`
Your active care records:

  ID                              TYPE           ROLE        HOURS      PARTNER
  ------------------------------  -------------  ----------  ---------  -----------`);

      for (const record of myRecords) {
        const id = record.recordId.slice(0, 28) + '...';
        const type = (record.careTypeName || record.careType).slice(0, 12).padEnd(13);
        const role = (record.caregiverAddress === userAddress ? 'Caregiver' : 'Recipient').padEnd(10);
        const hours = `${record.hoursCompleted}/${record.hours}`.padEnd(9);
        const partner = record.caregiverAddress === userAddress
          ? record.recipientName
          : record.caregiverName;
        console.log(`  ${id}  ${type}  ${role}  ${hours}  ${partner}`);
      }

      console.log(`
Track progress: npm run care:track -- --care <id> --hours 2 --note "Session notes"
Available outcomes: ${Object.keys(HEALTH_OUTCOMES).join(', ')}
`);
      return;
    }

    const record = deployment.careRecords.find(r => r.recordId === careId || r.recordId.startsWith(careId));
    if (!record) {
      log.error(`Care record not found: ${careId}`);
      process.exit(1);
    }

    if (record.caregiverAddress !== userAddress && record.recipientAddress !== userAddress) {
      log.error('You are not a party to this care record.');
      process.exit(1);
    }

    if (record.status !== CARE_STATUS.IN_PROGRESS) {
      log.error(`This care record is not in progress (status: ${record.status})`);
      process.exit(1);
    }

    // Add tracking note
    if (note || hoursWorked > 0) {
      const trackingNote = {
        noteId: generateId('note'),
        author: userPnft,
        authorName: userName,
        authorRole: record.caregiverAddress === userAddress ? 'caregiver' : 'recipient',
        hoursReported: hoursWorked,
        note: note,
        recordedAt: new Date().toISOString(),
      };
      record.trackingNotes.push(trackingNote);

      if (hoursWorked > 0) {
        record.hoursCompleted = Math.min(record.hours, record.hoursCompleted + hoursWorked);
      }
    }

    // Record outcome if provided
    if (outcomeArg) {
      const outcomes = outcomeArg.split(',').map(o => o.trim().toLowerCase());
      for (const outcome of outcomes) {
        // Validate outcome exists
        let found = false;
        for (const category of Object.values(HEALTH_OUTCOMES)) {
          if (category[outcome]) {
            found = true;
            if (!record.outcomes.includes(outcome)) {
              record.outcomes.push(outcome);
            }
            break;
          }
        }
        if (!found) {
          log.warn(`Unknown outcome: ${outcome}`);
        }
      }
    }

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
===============================================================================
                     CARE PROGRESS TRACKED
===============================================================================
  Care Record:     ${record.recordId}
  Type:            ${record.careTypeName}
-------------------------------------------------------------------------------
  Hours completed: ${record.hoursCompleted} / ${record.hours}
  Progress:        ${Math.round((record.hoursCompleted / record.hours) * 100)}%
  Tracking notes:  ${record.trackingNotes.length}
  Outcomes noted:  ${record.outcomes.length > 0 ? record.outcomes.join(', ') : '(none yet)'}
-------------------------------------------------------------------------------
`);

    if (record.hoursCompleted >= record.hours) {
      console.log(`
All hours completed! Ready to mark as complete:
  npm run care:complete -- --care ${record.recordId}
`);
    } else {
      console.log(`
Continue tracking: npm run care:track -- --care ${record.recordId} --hours <n> --note "..."
Record outcomes:   npm run care:track -- --care ${record.recordId} --outcome mobility_improved,mood_improved
`);
    }
    return;
  }

  // ==========================================================================
  // COMMAND: --complete (mark care as complete)
  // ==========================================================================
  if (completeIdx >= 0) {
    const careId = careIdx >= 0 ? args[careIdx + 1] : null;
    const note = noteIdx >= 0 ? args[noteIdx + 1] : '';
    const outcomeArg = outcomeIdx >= 0 ? args[outcomeIdx + 1] : null;

    if (!careId) {
      log.error('Missing --care <id>');
      process.exit(1);
    }

    const record = deployment.careRecords.find(r => r.recordId === careId || r.recordId.startsWith(careId));
    if (!record) {
      log.error(`Care record not found: ${careId}`);
      process.exit(1);
    }

    if (record.caregiverAddress !== userAddress && record.recipientAddress !== userAddress) {
      log.error('You are not a party to this care record.');
      process.exit(1);
    }

    if (record.status !== CARE_STATUS.IN_PROGRESS && record.status !== CARE_STATUS.PENDING_ATTESTATION) {
      log.error(`Cannot complete: status is ${record.status}`);
      process.exit(1);
    }

    // Record final outcomes if provided
    if (outcomeArg) {
      const outcomes = outcomeArg.split(',').map(o => o.trim().toLowerCase());
      for (const outcome of outcomes) {
        for (const category of Object.values(HEALTH_OUTCOMES)) {
          if (category[outcome] && !record.outcomes.includes(outcome)) {
            record.outcomes.push(outcome);
            break;
          }
        }
      }
    }

    // Add attestation
    const attestorRole = record.caregiverAddress === userAddress ? 'caregiver' : 'recipient';
    const existingAttestation = record.attestations.find(a => a.attestorAddress === userAddress);

    if (!existingAttestation) {
      const attestation = {
        attestor: userPnft,
        attestorAddress: userAddress,
        attestorName: userName,
        attestorRole: attestorRole,
        note: note,
        attestedAt: new Date().toISOString(),
        attestedSlot: getCurrentSlot(),
      };
      record.attestations.push(attestation);
    }

    // Check if we have sufficient attestations (need both parties)
    const hasCaregiver = record.attestations.some(a => a.attestorRole === 'caregiver');
    const hasRecipient = record.attestations.some(a => a.attestorRole === 'recipient');

    if (hasCaregiver && hasRecipient) {
      // Both parties have attested - calculate and award credits
      record.status = CARE_STATUS.CREDITED;
      record.completedAt = new Date().toISOString();
      record.completedSlot = getCurrentSlot();

      // Calculate credits with outcome bonuses
      const credits = calculateCredits(record.careType, record.hoursCompleted, record.outcomes);
      record.creditsEarned = credits;

      // Award credits to caregiver
      deployment.careCredits[record.caregiverAddress] = deployment.careCredits[record.caregiverAddress] || {
        totalCredits: 0,
        totalHours: 0,
        recordCount: 0,
        byType: {},
      };
      const caregiverCredits = deployment.careCredits[record.caregiverAddress];
      caregiverCredits.totalCredits += credits;
      caregiverCredits.totalHours += record.hoursCompleted;
      caregiverCredits.recordCount += 1;
      caregiverCredits.byType[record.careType] = (caregiverCredits.byType[record.careType] || 0) + credits;

      // Update associated need
      const need = deployment.careNeeds.find(n => n.needId === record.needId);
      if (need) {
        need.status = CARE_STATUS.CREDITED;
        need.completedAt = record.completedAt;
      }

      atomicWriteSync(CONFIG.deploymentPath, deployment);

      console.log(`
===============================================================================
                     CARE COMPLETED & CREDITED
===============================================================================
  Care Record:     ${record.recordId}
  Type:            ${record.careTypeName}
  Hours:           ${record.hoursCompleted}
-------------------------------------------------------------------------------
  ATTESTATIONS:
    Caregiver:     ${record.attestations.find(a => a.attestorRole === 'caregiver')?.attestorName}
    Recipient:     ${record.attestations.find(a => a.attestorRole === 'recipient')?.attestorName}
-------------------------------------------------------------------------------
  HEALTH OUTCOMES:
    ${record.outcomes.length > 0 ? record.outcomes.map(o => {
      for (const [cat, outcomes] of Object.entries(HEALTH_OUTCOMES)) {
        if (outcomes[o]) return `${outcomes[o].name} (${outcomes[o].weight}x)`;
      }
      return o;
    }).join('\n    ') : '(none recorded)'}
-------------------------------------------------------------------------------
  CREDITS EARNED:  ${credits} care credits
  (Awarded to ${record.caregiverName})
===============================================================================

Care credits boost UBI calculations and build community reputation.
View your care history: npm run care:my
`);
    } else {
      record.status = CARE_STATUS.PENDING_ATTESTATION;
      atomicWriteSync(CONFIG.deploymentPath, deployment);

      const waitingFor = !hasCaregiver ? 'caregiver' : 'recipient';
      const waitingName = !hasCaregiver ? record.caregiverName : record.recipientName;

      console.log(`
===============================================================================
                     ATTESTATION RECORDED
===============================================================================
  Care Record:     ${record.recordId}
  Your Role:       ${attestorRole}
  Status:          Pending attestation
-------------------------------------------------------------------------------
  Attestations:    ${record.attestations.length}/2
    Caregiver:     ${hasCaregiver ? 'Attested' : 'Pending'}
    Recipient:     ${hasRecipient ? 'Attested' : 'Pending'}
-------------------------------------------------------------------------------

Waiting for ${waitingName} (${waitingFor}) to complete their attestation.
They should run: npm run care:complete -- --care ${record.recordId}
`);
    }
    return;
  }

  // ==========================================================================
  // COMMAND: --my-care (show care history)
  // ==========================================================================
  if (myCareIdx >= 0) {
    const asCaregiver = deployment.careRecords.filter(r => r.caregiverAddress === userAddress);
    const asRecipient = deployment.careRecords.filter(r => r.recipientAddress === userAddress);
    const myCredits = deployment.careCredits[userAddress] || { totalCredits: 0, totalHours: 0, recordCount: 0, byType: {} };

    console.log(`
===============================================================================
                     ${userName}'s CARE HISTORY
===============================================================================

CARE CREDITS SUMMARY:
  Total credits:     ${myCredits.totalCredits}
  Total hours:       ${myCredits.totalHours}
  Care records:      ${myCredits.recordCount}

  Credits by type:`);

    for (const [type, credits] of Object.entries(myCredits.byType)) {
      const typeName = CARE_TYPES[type]?.name || type;
      console.log(`    ${typeName.padEnd(20)} ${credits} credits`);
    }

    if (Object.keys(myCredits.byType).length === 0) {
      console.log('    (none yet)');
    }

    console.log(`
-------------------------------------------------------------------------------
CARE GIVEN (as caregiver): ${asCaregiver.length} records
-------------------------------------------------------------------------------`);

    if (asCaregiver.length === 0) {
      console.log('  (no care given yet)');
    } else {
      for (const record of asCaregiver.slice(-5)) {
        const status = record.status.toUpperCase();
        const credits = record.status === CARE_STATUS.CREDITED ? ` (+${record.creditsEarned} credits)` : '';
        console.log(`  ${record.careTypeName.padEnd(15)} ${record.hoursCompleted}h to ${record.recipientName.padEnd(12)} [${status}]${credits}`);
      }
      if (asCaregiver.length > 5) {
        console.log(`  ... and ${asCaregiver.length - 5} more`);
      }
    }

    console.log(`
-------------------------------------------------------------------------------
CARE RECEIVED (as recipient): ${asRecipient.length} records
-------------------------------------------------------------------------------`);

    if (asRecipient.length === 0) {
      console.log('  (no care received yet)');
    } else {
      for (const record of asRecipient.slice(-5)) {
        const status = record.status.toUpperCase();
        console.log(`  ${record.careTypeName.padEnd(15)} ${record.hoursCompleted}h from ${record.caregiverName.padEnd(12)} [${status}]`);
      }
      if (asRecipient.length > 5) {
        console.log(`  ... and ${asRecipient.length - 5} more`);
      }
    }

    // Show open needs
    const myOpenNeeds = deployment.careNeeds.filter(n =>
      n.requesterAddress === userAddress && n.status === CARE_STATUS.NEED_OPEN
    );

    if (myOpenNeeds.length > 0) {
      console.log(`
-------------------------------------------------------------------------------
YOUR OPEN CARE NEEDS: ${myOpenNeeds.length}
-------------------------------------------------------------------------------`);
      for (const need of myOpenNeeds) {
        const offers = need.offers?.filter(o => o.status === CARE_STATUS.OFFER_PENDING).length || 0;
        console.log(`  ${need.careTypeName.padEnd(15)} ${need.hours}h   ${offers} offer(s)`);
      }
    }

    // Show pending offers
    const myPendingOffers = deployment.careOffers.filter(o =>
      o.caregiverAddress === userAddress && o.status === CARE_STATUS.OFFER_PENDING
    );

    if (myPendingOffers.length > 0) {
      console.log(`
-------------------------------------------------------------------------------
YOUR PENDING OFFERS: ${myPendingOffers.length}
-------------------------------------------------------------------------------`);
      for (const offer of myPendingOffers) {
        const need = deployment.careNeeds.find(n => n.needId === offer.needId);
        console.log(`  Offer to ${need?.requesterName || 'Unknown'} for ${need?.careTypeName || 'Unknown'}`);
      }
    }

    console.log(`
===============================================================================

Care credits contribute to:
  - Labor dignity score (boosts UBI)
  - Community reputation
  - Bioregion health metrics

Register a need:  npm run care:register -- --type eldercare --hours 4
Browse needs:     npm run care:list
`);
    return;
  }

  // Default: show help
  showHelp();
}

// =============================================================================
// HELP FUNCTIONS
// =============================================================================

function showHelp() {
  console.log(`
Usage: node care.mjs [command] [options]

COMMANDS:
  --register-need     Register a care need
  --list-needs        List open care needs
  --fulfill           Offer to fulfill a care need
  --accept            Accept a care offer
  --track             Track care progress
  --complete          Mark care as complete (creates attestation)
  --my-care           Show your care history and credits

OPTIONS:
  --user <name>       Act as test user (Alice, Bob, etc.)
  --type <type>       Care type (childcare, eldercare, disability, health, household, community, family)
  --hours <n>         Number of hours
  --desc <text>       Description
  --bioregion <name>  Filter by bioregion
  --need <id>         Care need ID
  --offer <id>        Care offer ID
  --care <id>         Care record ID
  --note <text>       Add a note
  --outcome <list>    Health outcomes (comma-separated)
  --urgent            Mark need as urgent
  --list-types        Show care type details

EXAMPLES:
  # Register a care need
  npm run care:register -- --type eldercare --hours 4 --desc "Weekly shopping help"

  # List care needs in your bioregion
  npm run care:list

  # Offer to fulfill a need
  npm run care:fulfill -- --need <id>

  # Accept an offer (as need requester)
  npm run care:accept -- --offer <id>

  # Track progress
  npm run care:track -- --care <id> --hours 2 --note "Completed shopping trip"

  # Record health outcomes
  npm run care:track -- --care <id> --outcome mobility_improved,mood_improved

  # Complete and attest
  npm run care:complete -- --care <id>

  # View care history
  npm run care:my

HEALTH OUTCOMES (for --outcome):
  Physical:   mobility_improved, pain_reduced, strength_increased, energy_improved
  Cognitive:  clarity_improved, memory_supported, engagement_increased
  Emotional:  mood_improved, anxiety_reduced, isolation_reduced, confidence_increased
  Practical:  independence_maintained, safety_improved, nutrition_improved, hygiene_maintained
`);
}

function listCareTypes() {
  console.log(`
===============================================================================
                     CARE TYPES
===============================================================================
`);
  for (const [key, type] of Object.entries(CARE_TYPES)) {
    console.log(`  ${key.toUpperCase()}`);
    console.log(`    Name:        ${type.name}`);
    console.log(`    Description: ${type.description}`);
    console.log(`    Credits/hr:  ${type.creditsPerHour}`);
    if (type.activities) console.log(`    Activities:  ${type.activities.join(', ')}`);
    if (type.levels) console.log(`    Levels:      ${type.levels.join(', ')}`);
    if (type.supportTypes) console.log(`    Support:     ${type.supportTypes.join(', ')}`);
    if (type.serviceTypes) console.log(`    Services:    ${type.serviceTypes.join(', ')}`);
    if (type.ageGroups) console.log(`    Age groups:  ${type.ageGroups.join(', ')}`);
    console.log('');
  }
}

// =============================================================================
// RUN
// =============================================================================

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
