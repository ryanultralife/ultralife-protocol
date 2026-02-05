#!/usr/bin/env node
/**
 * UltraLife Protocol — Grants CLI
 *
 * Manage grant programs, applications, and distributions.
 *
 * Usage:
 *   node grants.mjs --create-program --name "Research Fund" --budget 100000
 *   node grants.mjs --apply --program prog_123 --amount 5000
 *   node grants.mjs --list-programs
 *   node grants.mjs --approve --application app_123
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS
// =============================================================================

const GRANT_CATEGORIES = {
  research: { name: 'Research & Development', maxAmount: 50000 },
  conservation: { name: 'Conservation Projects', maxAmount: 100000 },
  education: { name: 'Education & Training', maxAmount: 25000 },
  infrastructure: { name: 'Infrastructure', maxAmount: 200000 },
  community: { name: 'Community Initiatives', maxAmount: 30000 },
  emergency: { name: 'Emergency Relief', maxAmount: 10000 },
  stewardship: { name: 'Land Stewardship', maxAmount: 75000 },
  health: { name: 'Health Programs', maxAmount: 40000 },
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { grants: { programs: [], applications: [], distributions: [] } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.grants) data.grants = { programs: [], applications: [], distributions: [] };
  return data;
}

async function saveDeploymentAsync(data) {
  const { atomicWriteSync } = await import('./utils.mjs');
  const deploymentPath = path.join(__dirname, 'deployment.json');
  atomicWriteSync(deploymentPath, data);
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function parseArgs(argv) {
  const args = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 2;
      } else {
        args[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return args;
}

function getUserPnft(deployment, userName) {
  if (userName) {
    const user = deployment.testUsers?.find(u =>
      u.name?.toLowerCase() === userName.toLowerCase()
    );
    if (user && user.pnft) {
      return { ...user.pnft, owner: user.name, address: user.address };
    }
  }
  if (deployment.pnfts && deployment.pnfts.length > 0) {
    const mainPnft = deployment.pnfts.find(p => p.isMainWallet) || deployment.pnfts[0];
    return { ...mainPnft, owner: 'Main', address: deployment.walletAddress };
  }
  return null;
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
===============================================================================
                    UltraLife Protocol — Grants
===============================================================================

Usage: node grants.mjs [command] [options]

COMMANDS:
  --create-program       Create a new grant program
    --name <name>        Program name
    --category <cat>     Category (see below)
    --budget <amount>    Total budget (ULTRA)
    --deadline <date>    Application deadline (YYYY-MM-DD)
    --bioregion <id>     Restrict to bioregion (optional)

  --list-programs        List grant programs
    --category <cat>     Filter by category
    --bioregion <id>     Filter by bioregion
    --open               Show only open programs

  --show-program         Show program details
    --program <id>       Program ID

  --apply                Apply for a grant
    --program <id>       Program ID
    --amount <amount>    Requested amount (ULTRA)
    --title <title>      Application title
    --description <text> Description
    --user <name>        Apply as test user

  --list-applications    List grant applications
    --program <id>       Filter by program
    --status <status>    Filter by status
    --user <name>        Filter by applicant

  --show-application     Show application details
    --application <id>   Application ID

  --approve              Approve an application
    --application <id>   Application ID
    --amount <amount>    Approved amount (optional, defaults to requested)
    --notes <text>       Approval notes

  --reject               Reject an application
    --application <id>   Application ID
    --reason <text>      Rejection reason

  --disburse             Disburse approved grant
    --application <id>   Application ID

  --report               Submit grant report
    --application <id>   Application ID
    --summary <text>     Report summary
    --outcomes <text>    Outcomes achieved

  --my-grants            Show your grants
    --user <name>        Check for test user

  --stats                Show grant statistics
    --bioregion <id>     For specific bioregion

  --list-categories      Show grant categories

  --help                 Show this help

GRANT CATEGORIES:
${Object.entries(GRANT_CATEGORIES).map(([k, v]) => `  ${k.padEnd(15)} ${v.name.padEnd(25)} (max ${v.maxAmount.toLocaleString()} ULTRA)`).join('\n')}

APPLICATION STATUS:
  pending    - Awaiting review
  approved   - Approved, pending disbursement
  rejected   - Not approved
  disbursed  - Funds released
  completed  - Project completed with report
`);
}

async function createProgram(args, deployment) {
  const name = args.name;
  const category = args.category || 'community';
  const budget = parseFloat(args.budget);
  const deadline = args.deadline;
  const bioregion = args.bioregion;

  if (!name) {
    console.error('Error: --name is required');
    return;
  }

  if (!budget || budget <= 0) {
    console.error('Error: --budget is required and must be positive');
    return;
  }

  if (!GRANT_CATEGORIES[category]) {
    console.error(`Error: Unknown category "${category}". Use --list-categories to see options.`);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  // Only Verified+ can create programs
  if (!['Verified', 'Steward'].includes(pnft.level)) {
    console.error('Error: Must be Verified or Steward level to create grant programs');
    return;
  }

  const categoryInfo = GRANT_CATEGORIES[category];

  const program = {
    programId: generateId('prog'),
    name,
    category,
    categoryName: categoryInfo.name,
    budget,
    remaining: budget,
    maxPerGrant: Math.min(categoryInfo.maxAmount, budget),
    deadline: deadline ? new Date(deadline).toISOString() : null,
    bioregion: bioregion || null,
    creator: pnft.id,
    creatorAddress: pnft.address,
    applications: [],
    approved: 0,
    disbursed: 0,
    createdAt: new Date().toISOString(),
    status: 'open',
    testnetSimulated: true,
  };

  deployment.grants.programs.push(program);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         GRANT PROGRAM CREATED
===============================================================================
  Program ID:    ${program.programId}
  Name:          ${name}
  Category:      ${categoryInfo.name}
-------------------------------------------------------------------------------
  Budget:        ${budget.toLocaleString()} ULTRA
  Max per grant: ${program.maxPerGrant.toLocaleString()} ULTRA
  Deadline:      ${deadline || 'No deadline'}
  Bioregion:     ${bioregion || 'All bioregions'}
-------------------------------------------------------------------------------

Apply with: npm run grants:apply -- --program ${program.programId} --amount <amount>
`);
}

function listPrograms(args, deployment) {
  const category = args.category;
  const bioregion = args.bioregion;
  const openOnly = args.open;

  let programs = deployment.grants.programs || [];

  if (category) {
    programs = programs.filter(p => p.category === category);
  }

  if (bioregion) {
    programs = programs.filter(p => !p.bioregion || p.bioregion === bioregion);
  }

  if (openOnly) {
    programs = programs.filter(p => p.status === 'open' && p.remaining > 0);
  }

  console.log(`
===============================================================================
                    GRANT PROGRAMS
===============================================================================`);

  if (programs.length === 0) {
    console.log('\n  No grant programs found.\n');
    return;
  }

  console.log('\n  ID                    NAME                    CATEGORY        BUDGET      STATUS');
  console.log('  --------------------  ----------------------  --------------  ----------  ------');

  for (const p of programs) {
    const budgetStr = `${(p.remaining / 1000).toFixed(0)}k/${(p.budget / 1000).toFixed(0)}k`;
    console.log(`  ${p.programId.padEnd(20)}  ${p.name.slice(0, 22).padEnd(22)}  ${p.categoryName.slice(0, 14).padEnd(14)}  ${budgetStr.padEnd(10)}  ${p.status}`);
  }

  const totalBudget = programs.reduce((sum, p) => sum + p.budget, 0);
  const totalRemaining = programs.reduce((sum, p) => sum + p.remaining, 0);

  console.log(`
-------------------------------------------------------------------------------
  Total: ${programs.length} programs
  Budget: ${totalRemaining.toLocaleString()} / ${totalBudget.toLocaleString()} ULTRA remaining
`);
}

function showProgram(args, deployment) {
  const programId = args.program;

  if (!programId) {
    console.error('Error: --program is required');
    return;
  }

  const program = deployment.grants.programs.find(p => p.programId === programId);
  if (!program) {
    console.error(`Error: Program ${programId} not found`);
    return;
  }

  const applications = deployment.grants.applications.filter(a => a.programId === programId);
  const pending = applications.filter(a => a.status === 'pending').length;
  const approved = applications.filter(a => ['approved', 'disbursed', 'completed'].includes(a.status)).length;

  console.log(`
===============================================================================
                    ${program.name}
===============================================================================
  Program ID:    ${program.programId}
  Category:      ${program.categoryName}
  Status:        ${program.status.toUpperCase()}
  Created:       ${new Date(program.createdAt).toLocaleString()}
-------------------------------------------------------------------------------
  BUDGET:
    Total:       ${program.budget.toLocaleString()} ULTRA
    Remaining:   ${program.remaining.toLocaleString()} ULTRA
    Disbursed:   ${program.disbursed.toLocaleString()} ULTRA
    Max/grant:   ${program.maxPerGrant.toLocaleString()} ULTRA
-------------------------------------------------------------------------------
  DEADLINE:      ${program.deadline ? new Date(program.deadline).toLocaleString() : 'No deadline'}
  BIOREGION:     ${program.bioregion || 'All bioregions'}
-------------------------------------------------------------------------------
  APPLICATIONS:
    Total:       ${applications.length}
    Pending:     ${pending}
    Approved:    ${approved}
`);
}

async function applyForGrant(args, deployment) {
  const programId = args.program;
  const amount = parseFloat(args.amount);
  const title = args.title;
  const description = args.description || '';
  const userName = args.user;

  if (!programId || !amount || !title) {
    console.error('Error: --program, --amount, and --title are required');
    return;
  }

  const program = deployment.grants.programs.find(p => p.programId === programId);
  if (!program) {
    console.error(`Error: Program ${programId} not found`);
    return;
  }

  if (program.status !== 'open') {
    console.error(`Error: Program is ${program.status}`);
    return;
  }

  if (program.deadline && new Date() > new Date(program.deadline)) {
    console.error('Error: Application deadline has passed');
    return;
  }

  if (amount > program.maxPerGrant) {
    console.error(`Error: Amount exceeds max per grant (${program.maxPerGrant})`);
    return;
  }

  if (amount > program.remaining) {
    console.error(`Error: Amount exceeds remaining budget (${program.remaining})`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (program.bioregion && pnft.bioregion !== program.bioregion) {
    console.error(`Error: Program restricted to ${program.bioregion} bioregion`);
    return;
  }

  // Check for existing application
  const existing = deployment.grants.applications.find(a =>
    a.programId === programId &&
    a.applicant === pnft.id &&
    !['rejected', 'completed'].includes(a.status)
  );

  if (existing) {
    console.error(`Error: Already have a pending application (${existing.applicationId})`);
    return;
  }

  const application = {
    applicationId: generateId('app'),
    programId,
    programName: program.name,
    applicant: pnft.id,
    applicantAddress: pnft.address,
    applicantName: pnft.owner,
    bioregion: pnft.bioregion,
    title,
    description,
    requestedAmount: amount,
    approvedAmount: null,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    reports: [],
    testnetSimulated: true,
  };

  deployment.grants.applications.push(application);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         GRANT APPLICATION SUBMITTED
===============================================================================
  Application ID: ${application.applicationId}
  Program:        ${program.name}
  Title:          ${title}
-------------------------------------------------------------------------------
  Applicant:      ${pnft.owner}
  Bioregion:      ${pnft.bioregion}
  Amount:         ${amount.toLocaleString()} ULTRA
  Status:         PENDING
-------------------------------------------------------------------------------

Your application is under review.
`);
}

function listApplications(args, deployment) {
  const programId = args.program;
  const status = args.status;
  const userName = args.user;

  let applications = deployment.grants.applications || [];

  if (programId) {
    applications = applications.filter(a => a.programId === programId);
  }

  if (status) {
    applications = applications.filter(a => a.status === status);
  }

  if (userName) {
    const pnft = getUserPnft(deployment, userName);
    if (pnft) {
      applications = applications.filter(a => a.applicant === pnft.id);
    }
  }

  console.log(`
===============================================================================
                    GRANT APPLICATIONS
===============================================================================`);

  if (applications.length === 0) {
    console.log('\n  No applications found.\n');
    return;
  }

  console.log('\n  ID                    PROGRAM                 AMOUNT      STATUS');
  console.log('  --------------------  ----------------------  ----------  ---------');

  for (const a of applications) {
    console.log(`  ${a.applicationId.padEnd(20)}  ${a.programName.slice(0, 22).padEnd(22)}  ${String(a.requestedAmount).padStart(10)}  ${a.status}`);
  }

  console.log(`\n  Total: ${applications.length} applications\n`);
}

function showApplication(args, deployment) {
  const applicationId = args.application;

  if (!applicationId) {
    console.error('Error: --application is required');
    return;
  }

  const application = deployment.grants.applications.find(a => a.applicationId === applicationId);
  if (!application) {
    console.error(`Error: Application ${applicationId} not found`);
    return;
  }

  console.log(`
===============================================================================
                    GRANT APPLICATION
===============================================================================
  Application ID: ${application.applicationId}
  Program:        ${application.programName}
  Status:         ${application.status.toUpperCase()}
-------------------------------------------------------------------------------
  APPLICANT:
    pNFT:         ${application.applicant}
    Name:         ${application.applicantName}
    Bioregion:    ${application.bioregion}
-------------------------------------------------------------------------------
  REQUEST:
    Title:        ${application.title}
    Amount:       ${application.requestedAmount.toLocaleString()} ULTRA
    ${application.approvedAmount ? `Approved:     ${application.approvedAmount.toLocaleString()} ULTRA` : ''}
-------------------------------------------------------------------------------
  Description:
    ${application.description || '(No description)'}
-------------------------------------------------------------------------------
  TIMELINE:
    Submitted:    ${new Date(application.submittedAt).toLocaleString()}
    ${application.approvedAt ? `Approved:     ${new Date(application.approvedAt).toLocaleString()}` : ''}
    ${application.disbursedAt ? `Disbursed:    ${new Date(application.disbursedAt).toLocaleString()}` : ''}
`);
}

async function approveApplication(args, deployment) {
  const applicationId = args.application;
  const amount = args.amount ? parseFloat(args.amount) : null;
  const notes = args.notes || '';

  if (!applicationId) {
    console.error('Error: --application is required');
    return;
  }

  const application = deployment.grants.applications.find(a => a.applicationId === applicationId);
  if (!application) {
    console.error(`Error: Application ${applicationId} not found`);
    return;
  }

  if (application.status !== 'pending') {
    console.error(`Error: Application is ${application.status}`);
    return;
  }

  const program = deployment.grants.programs.find(p => p.programId === application.programId);
  if (!program) {
    console.error('Error: Program not found');
    return;
  }

  const approvedAmount = amount || application.requestedAmount;

  if (approvedAmount > program.remaining) {
    console.error(`Error: Amount exceeds program remaining budget (${program.remaining})`);
    return;
  }

  application.status = 'approved';
  application.approvedAmount = approvedAmount;
  application.approvedAt = new Date().toISOString();
  application.approvalNotes = notes;

  program.approved += approvedAmount;

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         APPLICATION APPROVED
===============================================================================
  Application:   ${applicationId}
  Amount:        ${approvedAmount.toLocaleString()} ULTRA
  ${notes ? `Notes:         ${notes}` : ''}
-------------------------------------------------------------------------------

Disburse with: npm run grants:disburse -- --application ${applicationId}
`);
}

async function rejectApplication(args, deployment) {
  const applicationId = args.application;
  const reason = args.reason || 'Does not meet program criteria';

  if (!applicationId) {
    console.error('Error: --application is required');
    return;
  }

  const application = deployment.grants.applications.find(a => a.applicationId === applicationId);
  if (!application) {
    console.error(`Error: Application ${applicationId} not found`);
    return;
  }

  if (application.status !== 'pending') {
    console.error(`Error: Application is ${application.status}`);
    return;
  }

  application.status = 'rejected';
  application.rejectedAt = new Date().toISOString();
  application.rejectionReason = reason;

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         APPLICATION REJECTED
===============================================================================
  Application:   ${applicationId}
  Reason:        ${reason}
`);
}

async function disburseGrant(args, deployment) {
  const applicationId = args.application;

  if (!applicationId) {
    console.error('Error: --application is required');
    return;
  }

  const application = deployment.grants.applications.find(a => a.applicationId === applicationId);
  if (!application) {
    console.error(`Error: Application ${applicationId} not found`);
    return;
  }

  if (application.status !== 'approved') {
    console.error(`Error: Application must be approved first (currently ${application.status})`);
    return;
  }

  const program = deployment.grants.programs.find(p => p.programId === application.programId);
  if (!program) {
    console.error('Error: Program not found');
    return;
  }

  const amount = application.approvedAmount;

  if (amount > program.remaining) {
    console.error(`Error: Insufficient program funds (${program.remaining} < ${amount})`);
    return;
  }

  // Create distribution record
  const distribution = {
    distributionId: generateId('dist'),
    applicationId,
    programId: program.programId,
    recipient: application.applicant,
    recipientAddress: application.applicantAddress,
    amount,
    disbursedAt: new Date().toISOString(),
    testnetSimulated: true,
  };

  application.status = 'disbursed';
  application.disbursedAt = distribution.disbursedAt;
  program.remaining -= amount;
  program.disbursed += amount;

  // Update balance
  if (!deployment.ultraBalances) deployment.ultraBalances = {};
  deployment.ultraBalances[application.applicantAddress] =
    (deployment.ultraBalances[application.applicantAddress] || 0) + amount;

  deployment.grants.distributions.push(distribution);
  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         GRANT DISBURSED
===============================================================================
  Application:   ${applicationId}
  Recipient:     ${application.applicantName}
  Amount:        ${amount.toLocaleString()} ULTRA
-------------------------------------------------------------------------------
  Program remaining: ${program.remaining.toLocaleString()} ULTRA
`);
}

async function submitReport(args, deployment) {
  const applicationId = args.application;
  const summary = args.summary;
  const outcomes = args.outcomes || '';

  if (!applicationId || !summary) {
    console.error('Error: --application and --summary are required');
    return;
  }

  const application = deployment.grants.applications.find(a => a.applicationId === applicationId);
  if (!application) {
    console.error(`Error: Application ${applicationId} not found`);
    return;
  }

  if (application.status !== 'disbursed') {
    console.error(`Error: Can only report on disbursed grants (currently ${application.status})`);
    return;
  }

  const report = {
    reportId: generateId('report'),
    summary,
    outcomes,
    submittedAt: new Date().toISOString(),
  };

  application.reports.push(report);
  application.status = 'completed';
  application.completedAt = new Date().toISOString();

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         GRANT REPORT SUBMITTED
===============================================================================
  Application:   ${applicationId}
  Status:        COMPLETED
-------------------------------------------------------------------------------
  Summary:
    ${summary}

  Outcomes:
    ${outcomes || '(Not specified)'}
`);
}

function myGrants(args, deployment) {
  const userName = args.user;
  const pnft = getUserPnft(deployment, userName);

  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const applications = deployment.grants.applications.filter(a => a.applicant === pnft.id);

  console.log(`
===============================================================================
                    My Grants — ${pnft.owner}
===============================================================================`);

  if (applications.length === 0) {
    console.log('\n  No grant applications found.\n');
    return;
  }

  const pending = applications.filter(a => a.status === 'pending');
  const approved = applications.filter(a => a.status === 'approved');
  const disbursed = applications.filter(a => a.status === 'disbursed');
  const completed = applications.filter(a => a.status === 'completed');

  const totalReceived = applications
    .filter(a => ['disbursed', 'completed'].includes(a.status))
    .reduce((sum, a) => sum + (a.approvedAmount || 0), 0);

  console.log(`
  STATUS SUMMARY:
    Pending:     ${pending.length}
    Approved:    ${approved.length}
    Disbursed:   ${disbursed.length}
    Completed:   ${completed.length}

  Total Received: ${totalReceived.toLocaleString()} ULTRA
-------------------------------------------------------------------------------`);

  for (const app of applications) {
    console.log(`
  ${app.title}
    ID:       ${app.applicationId}
    Program:  ${app.programName}
    Amount:   ${app.requestedAmount.toLocaleString()} ULTRA
    Status:   ${app.status.toUpperCase()}`);
  }

  console.log('');
}

function showStats(args, deployment) {
  const bioregion = args.bioregion;

  let programs = deployment.grants.programs || [];
  let applications = deployment.grants.applications || [];

  if (bioregion) {
    programs = programs.filter(p => !p.bioregion || p.bioregion === bioregion);
    applications = applications.filter(a => a.bioregion === bioregion);
  }

  const totalBudget = programs.reduce((sum, p) => sum + p.budget, 0);
  const totalDisbursed = programs.reduce((sum, p) => sum + p.disbursed, 0);
  const totalRemaining = programs.reduce((sum, p) => sum + p.remaining, 0);

  const byCategory = {};
  for (const p of programs) {
    byCategory[p.category] = byCategory[p.category] || { count: 0, budget: 0, disbursed: 0 };
    byCategory[p.category].count++;
    byCategory[p.category].budget += p.budget;
    byCategory[p.category].disbursed += p.disbursed;
  }

  console.log(`
===============================================================================
                    GRANT STATISTICS
                    ${bioregion ? `Bioregion: ${bioregion}` : 'All Bioregions'}
===============================================================================
  PROGRAMS:        ${programs.length}
  APPLICATIONS:    ${applications.length}
    Pending:       ${applications.filter(a => a.status === 'pending').length}
    Approved:      ${applications.filter(a => a.status === 'approved').length}
    Disbursed:     ${applications.filter(a => ['disbursed', 'completed'].includes(a.status)).length}
-------------------------------------------------------------------------------
  BUDGET:
    Total:         ${totalBudget.toLocaleString()} ULTRA
    Disbursed:     ${totalDisbursed.toLocaleString()} ULTRA
    Remaining:     ${totalRemaining.toLocaleString()} ULTRA
-------------------------------------------------------------------------------
  BY CATEGORY:
`);

  for (const [cat, data] of Object.entries(byCategory)) {
    const catName = GRANT_CATEGORIES[cat]?.name || cat;
    console.log(`    ${catName.padEnd(22)} ${String(data.count).padStart(3)} programs, ${data.disbursed.toLocaleString().padStart(10)} / ${data.budget.toLocaleString().padStart(10)} ULTRA`);
  }

  console.log('');
}

function listCategories() {
  console.log(`
===============================================================================
                    GRANT CATEGORIES
===============================================================================
`);

  for (const [key, cat] of Object.entries(GRANT_CATEGORIES)) {
    console.log(`  ${key.padEnd(15)} ${cat.name}`);
    console.log(`                 Max per grant: ${cat.maxAmount.toLocaleString()} ULTRA`);
    console.log('');
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deployment = loadDeployment();

  if (args.help || Object.keys(args).length === 0) {
    showHelp();
    return;
  }

  if (args['create-program']) {
    await createProgram(args, deployment);
    return;
  }

  if (args['list-programs']) {
    listPrograms(args, deployment);
    return;
  }

  if (args['show-program']) {
    showProgram(args, deployment);
    return;
  }

  if (args.apply) {
    await applyForGrant(args, deployment);
    return;
  }

  if (args['list-applications']) {
    listApplications(args, deployment);
    return;
  }

  if (args['show-application']) {
    showApplication(args, deployment);
    return;
  }

  if (args.approve) {
    await approveApplication(args, deployment);
    return;
  }

  if (args.reject) {
    await rejectApplication(args, deployment);
    return;
  }

  if (args.disburse) {
    await disburseGrant(args, deployment);
    return;
  }

  if (args.report) {
    await submitReport(args, deployment);
    return;
  }

  if (args['my-grants']) {
    myGrants(args, deployment);
    return;
  }

  if (args.stats) {
    showStats(args, deployment);
    return;
  }

  if (args['list-categories']) {
    listCategories();
    return;
  }

  showHelp();
}

main().catch(console.error);
