#!/usr/bin/env node
/**
 * UltraLife Protocol — Registry & Thing CLI
 *
 * Hierarchical classification system for universal identifiers.
 * Clear hierarchy of assignments. Parent governs children.
 * Specialists create subcategories. The taxonomy grows organically.
 *
 * Usage:
 *   node registry-thing.mjs --create-root --name "Materials" --spec <hash>
 *   node registry-thing.mjs --create-child --parent <id> --name "Metals" --spec <hash>
 *   node registry-thing.mjs --list-categories
 *   node registry-thing.mjs --show --category <id>
 *   node registry-thing.mjs --register-thing --category <id> --metadata <hash>
 *   node registry-thing.mjs --transform --inputs <ids> --process <id> --output-category <id>
 *   node registry-thing.mjs --transfer-thing --thing <id> --to <pnft>
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deploymentPath = path.join(__dirname, 'deployment.json');

// =============================================================================
// CONSTANTS
// =============================================================================

const PNFT_LEVELS = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];

const IMPACT_CATEGORIES = {
  carbon: { name: 'Carbon', unit: 'kg CO2e', direction: 'negative better' },
  water: { name: 'Water', unit: 'L', direction: 'negative better' },
  biodiversity: { name: 'Biodiversity', unit: 'index', direction: 'positive better' },
};

// Pre-defined root categories for bootstrapping
const BOOTSTRAP_CATEGORIES = [
  { id: 'root_materials', name: 'Materials', desc: 'Raw and processed materials' },
  { id: 'root_food', name: 'Food', desc: 'Food and agricultural products' },
  { id: 'root_energy', name: 'Energy', desc: 'Energy sources and carriers' },
  { id: 'root_services', name: 'Services', desc: 'Services and work' },
  { id: 'root_land', name: 'Land', desc: 'Land classifications and uses' },
  { id: 'root_organisms', name: 'Organisms', desc: 'Living things' },
  { id: 'root_processes', name: 'Processes', desc: 'Transformation processes' },
];

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  if (!fs.existsSync(deploymentPath)) {
    return {
      registry: {
        categories: [],
        things: [],
      },
      pnfts: [],
      testUsers: [],
    };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.registry) {
    data.registry = {
      categories: [],
      things: [],
    };
  }
  return data;
}

function saveDeployment(data) {
  fs.writeFileSync(deploymentPath, JSON.stringify(data, null, 2));
}

function generateEntryId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `entry_${timestamp}_${random}`;
}

function generateThingId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `thing_${timestamp}_${random}`;
}

function getCurrentSlot() {
  const genesisTime = 1666656000;
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - genesisTime;
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().replace('T', ' ').substr(0, 19);
}

function hashName(name) {
  return crypto.createHash('sha256').update(name).digest('hex').substring(0, 32);
}

function getUserPnft(deployment, userName) {
  if (userName) {
    const user = deployment.testUsers?.find(u =>
      u.name?.toLowerCase() === userName.toLowerCase()
    );
    if (user && user.pnftId) {
      const pnft = deployment.pnfts?.find(p => p.id === user.pnftId);
      return pnft ? { ...pnft, owner: user.name, address: user.address } : null;
    }
  }
  // Default to first steward or verified pNFT
  if (deployment.pnfts && deployment.pnfts.length > 0) {
    const stewardPnft = deployment.pnfts.find(p => p.level === 'Steward');
    const verifiedPnft = deployment.pnfts.find(p => p.level === 'Verified');
    const pnft = stewardPnft || verifiedPnft || deployment.pnfts[0];
    return { ...pnft, owner: pnft.id };
  }
  return null;
}

function isSteward(level) {
  return level === 'Steward';
}

function canRegister(level) {
  return level === 'Verified' || level === 'Steward';
}

function buildCategoryPath(registry, categoryId) {
  const path = [];
  let current = registry.categories.find(c => c.entryId === categoryId);

  while (current) {
    path.unshift(current.name);
    if (current.parent) {
      current = registry.categories.find(c => c.entryId === current.parent);
    } else {
      break;
    }
  }

  return path.join(' > ');
}

function getChildren(registry, parentId) {
  return registry.categories.filter(c => c.parent === parentId);
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
========================================================================
              UltraLife Protocol - Registry & Thing

    Hierarchical classification system for universal identifiers.
    Clear hierarchy of assignments. Parent governs children.
    Specialists create subcategories. The taxonomy grows organically.
========================================================================

Usage: node registry-thing.mjs [command] [options]

REGISTRY COMMANDS:

  --create-root                 Create a root category (Steward only)
    --name <name>               Category name
    --spec <hash>               IPFS hash for specification/standards

  --create-child                Create child category under existing parent
    --parent <id>               Parent category ID
    --name <name>               Category name
    --spec <hash>               IPFS hash for specification/standards

  --add-delegate                Add delegate to a category
    --category <id>             Category ID
    --delegate <pnft>           Delegate pNFT ID

  --remove-delegate             Remove delegate from category
    --category <id>             Category ID
    --delegate <pnft>           Delegate pNFT ID

  --update-spec                 Update category specification
    --category <id>             Category ID
    --spec <hash>               New IPFS hash

  --transfer-governance         Transfer governance of category
    --category <id>             Category ID
    --to <pnft>                 New governor pNFT ID

  --deactivate                  Deactivate a category (cannot delete)
    --category <id>             Category ID

  --list-categories             List all categories
    --parent <id>               Filter by parent (use 'root' for roots)
    --active                    Only show active categories

  --show --category <id>        Show category details

  --tree                        Show full category tree

  --bootstrap                   Initialize with default root categories

THING COMMANDS:

  --register-thing              Register a new thing (origin point)
    --category <id>             Category ID
    --metadata <hash>           IPFS hash for metadata
    --location <bioregion>      Current location (bioregion)
    --impact-carbon <value>     Carbon impact (negative = bad)
    --impact-water <value>      Water impact (negative = bad)
    --impact-bio <value>        Biodiversity impact (positive = good)

  --transform                   Transform thing(s) into new thing
    --inputs <ids>              Comma-separated input thing IDs
    --process <id>              Process category ID
    --output-category <id>      Output category ID
    --metadata <hash>           Output metadata hash

  --transfer-thing              Transfer thing ownership
    --thing <id>                Thing ID
    --to <pnft>                 New owner pNFT ID

  --update-metadata             Update thing metadata
    --thing <id>                Thing ID
    --metadata <hash>           New metadata hash

  --list-things                 List all things
    --category <id>             Filter by category
    --owner <pnft>              Filter by owner
    --location <bioregion>      Filter by location

  --show --thing <id>           Show thing details with impact chain

  --trace --thing <id>          Trace thing's transformation history

OPTIONS:
  --user <name>                 Act as test user (Alice, Bob, etc.)
  --help                        Show this help

HIERARCHY EXAMPLE:
  Root: Materials (Steward creates)
    Category: Metals (governor creates)
      Category: Steel (delegate creates)
        Thing: steel_batch_001 (Verified+ registers)
          Transform: steel_component_001 (includes origin)

IMPACT TRACKING:
  - Every thing has aggregated impact summary
  - Transform aggregates inputs + transformation impact
  - No full chain stored, just totals + proof references
`);
}

function bootstrap(deployment) {
  const registry = deployment.registry;

  // Check if already bootstrapped
  const existingRoots = registry.categories.filter(c => !c.parent);
  if (existingRoots.length > 0) {
    console.log('\nRegistry already has root categories. Skipping bootstrap.');
    listCategories({ parent: 'root' }, deployment);
    return;
  }

  const pnft = getUserPnft(deployment);
  if (!pnft) {
    console.error('Error: No pNFT found. Mint a pNFT first.');
    return;
  }

  const slot = getCurrentSlot();

  for (const cat of BOOTSTRAP_CATEGORIES) {
    const entry = {
      entryId: cat.id,
      parent: null,
      name: cat.name,
      nameHash: hashName(cat.name),
      specHash: hashName(cat.desc),
      description: cat.desc,
      governor: pnft.id,
      delegates: [],
      createdAt: slot,
      createdAtTime: new Date().toISOString(),
      active: true,
      childCount: 0,
      thingCount: 0,
    };
    registry.categories.push(entry);
  }

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                     REGISTRY BOOTSTRAPPED                              ');
  console.log('========================================================================\n');

  console.log(`  Created ${BOOTSTRAP_CATEGORIES.length} root categories:`);
  for (const cat of BOOTSTRAP_CATEGORIES) {
    console.log(`    - ${cat.name}: ${cat.desc}`);
  }
  console.log(`\n  Governor: ${pnft.id}`);
}

function createRoot(args, deployment) {
  const name = args.name;
  const spec = args.spec || hashName(name + '_spec');
  const userName = args.user;

  if (!name) {
    console.error('Error: --name is required');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (!isSteward(pnft.level)) {
    console.error(`Error: Only Stewards can create root categories. You are ${pnft.level}.`);
    return;
  }

  // Check for duplicate name at root level
  const existingRoot = deployment.registry.categories.find(c =>
    !c.parent && c.name.toLowerCase() === name.toLowerCase()
  );
  if (existingRoot) {
    console.error(`Error: Root category "${name}" already exists`);
    return;
  }

  const slot = getCurrentSlot();
  const entry = {
    entryId: generateEntryId(),
    parent: null,
    name: name,
    nameHash: hashName(name),
    specHash: spec,
    governor: pnft.id,
    delegates: [],
    createdAt: slot,
    createdAtTime: new Date().toISOString(),
    active: true,
    childCount: 0,
    thingCount: 0,
  };

  deployment.registry.categories.push(entry);
  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                    ROOT CATEGORY CREATED                               ');
  console.log('========================================================================\n');

  console.log(`  ID:         ${entry.entryId}`);
  console.log(`  Name:       ${name}`);
  console.log(`  Governor:   ${pnft.id}`);
  console.log(`  Spec Hash:  ${spec.substring(0, 32)}...`);
}

function createChild(args, deployment) {
  const parentId = args.parent;
  const name = args.name;
  const spec = args.spec || hashName(name + '_spec');
  const userName = args.user;

  if (!parentId || !name) {
    console.error('Error: --parent and --name are required');
    return;
  }

  const parent = deployment.registry.categories.find(c => c.entryId === parentId);
  if (!parent) {
    console.error(`Error: Parent category ${parentId} not found`);
    return;
  }

  if (!parent.active) {
    console.error('Error: Cannot create child under deactivated category');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  // Check authorization (governor or delegate of parent)
  const isGovernor = pnft.id === parent.governor;
  const isDelegate = parent.delegates.includes(pnft.id);

  if (!isGovernor && !isDelegate) {
    console.error(`Error: Not authorized. Only governor or delegates of ${parent.name} can create children.`);
    return;
  }

  // Check for duplicate name under same parent
  const existingChild = deployment.registry.categories.find(c =>
    c.parent === parentId && c.name.toLowerCase() === name.toLowerCase()
  );
  if (existingChild) {
    console.error(`Error: Category "${name}" already exists under ${parent.name}`);
    return;
  }

  const slot = getCurrentSlot();
  const entry = {
    entryId: generateEntryId(),
    parent: parentId,
    name: name,
    nameHash: hashName(name),
    specHash: spec,
    governor: pnft.id,
    delegates: [],
    createdAt: slot,
    createdAtTime: new Date().toISOString(),
    active: true,
    childCount: 0,
    thingCount: 0,
  };

  deployment.registry.categories.push(entry);
  parent.childCount = (parent.childCount || 0) + 1;

  saveDeployment(deployment);

  const path = buildCategoryPath(deployment.registry, entry.entryId);

  console.log('\n========================================================================');
  console.log('                    CHILD CATEGORY CREATED                              ');
  console.log('========================================================================\n');

  console.log(`  ID:         ${entry.entryId}`);
  console.log(`  Name:       ${name}`);
  console.log(`  Path:       ${path}`);
  console.log(`  Parent:     ${parent.name}`);
  console.log(`  Governor:   ${pnft.id}`);
}

function addDelegate(args, deployment) {
  const categoryId = args.category;
  const delegate = args.delegate;
  const userName = args.user;

  if (!categoryId || !delegate) {
    console.error('Error: --category and --delegate are required');
    return;
  }

  const category = deployment.registry.categories.find(c => c.entryId === categoryId);
  if (!category) {
    console.error(`Error: Category ${categoryId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft || pnft.id !== category.governor) {
    console.error('Error: Only the governor can add delegates');
    return;
  }

  // Check delegate exists
  const delegatePnft = deployment.pnfts?.find(p => p.id === delegate);
  if (!delegatePnft) {
    console.error(`Error: pNFT ${delegate} not found`);
    return;
  }

  if (category.delegates.includes(delegate)) {
    console.error('Error: Already a delegate');
    return;
  }

  category.delegates.push(delegate);
  saveDeployment(deployment);

  console.log(`\nDelegate ${delegate} added to ${category.name}`);
}

function removeDelegate(args, deployment) {
  const categoryId = args.category;
  const delegate = args.delegate;
  const userName = args.user;

  if (!categoryId || !delegate) {
    console.error('Error: --category and --delegate are required');
    return;
  }

  const category = deployment.registry.categories.find(c => c.entryId === categoryId);
  if (!category) {
    console.error(`Error: Category ${categoryId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft || pnft.id !== category.governor) {
    console.error('Error: Only the governor can remove delegates');
    return;
  }

  category.delegates = category.delegates.filter(d => d !== delegate);
  saveDeployment(deployment);

  console.log(`\nDelegate ${delegate} removed from ${category.name}`);
}

function updateSpec(args, deployment) {
  const categoryId = args.category;
  const spec = args.spec;
  const userName = args.user;

  if (!categoryId || !spec) {
    console.error('Error: --category and --spec are required');
    return;
  }

  const category = deployment.registry.categories.find(c => c.entryId === categoryId);
  if (!category) {
    console.error(`Error: Category ${categoryId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  const isGovernor = pnft && pnft.id === category.governor;
  const isDelegate = pnft && category.delegates.includes(pnft.id);

  if (!isGovernor && !isDelegate) {
    console.error('Error: Only governor or delegates can update spec');
    return;
  }

  category.specHash = spec;
  category.updatedAt = new Date().toISOString();

  saveDeployment(deployment);

  console.log(`\nSpec updated for ${category.name}`);
}

function transferGovernance(args, deployment) {
  const categoryId = args.category;
  const toPnft = args.to;
  const userName = args.user;

  if (!categoryId || !toPnft) {
    console.error('Error: --category and --to are required');
    return;
  }

  const category = deployment.registry.categories.find(c => c.entryId === categoryId);
  if (!category) {
    console.error(`Error: Category ${categoryId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft || pnft.id !== category.governor) {
    console.error('Error: Only the governor can transfer governance');
    return;
  }

  const newGovernor = deployment.pnfts?.find(p => p.id === toPnft);
  if (!newGovernor) {
    console.error(`Error: pNFT ${toPnft} not found`);
    return;
  }

  const previousGovernor = category.governor;
  category.governor = toPnft;

  saveDeployment(deployment);

  console.log(`\nGovernance of ${category.name} transferred from ${previousGovernor} to ${toPnft}`);
}

function deactivate(args, deployment) {
  const categoryId = args.category;
  const userName = args.user;

  if (!categoryId) {
    console.error('Error: --category is required');
    return;
  }

  const category = deployment.registry.categories.find(c => c.entryId === categoryId);
  if (!category) {
    console.error(`Error: Category ${categoryId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft || pnft.id !== category.governor) {
    console.error('Error: Only the governor can deactivate');
    return;
  }

  category.active = false;
  category.deactivatedAt = new Date().toISOString();

  saveDeployment(deployment);

  console.log(`\nCategory ${category.name} deactivated`);
}

function listCategories(args, deployment) {
  let categories = deployment.registry.categories || [];
  const parentFilter = args.parent;
  const activeOnly = args.active;

  if (parentFilter === 'root') {
    categories = categories.filter(c => !c.parent);
  } else if (parentFilter) {
    categories = categories.filter(c => c.parent === parentFilter);
  }

  if (activeOnly) {
    categories = categories.filter(c => c.active);
  }

  console.log('\n=== Registry Categories ===\n');

  if (categories.length === 0) {
    console.log('  No categories found.');
    console.log('  Use --bootstrap to create default root categories.');
    return;
  }

  console.log('ID                        NAME                 GOVERNOR                  CHILDREN  THINGS');
  console.log('-'.repeat(100));

  for (const cat of categories) {
    const status = cat.active ? '' : ' (inactive)';
    const path = cat.parent ? buildCategoryPath(deployment.registry, cat.entryId) : cat.name;
    console.log(
      `${cat.entryId.padEnd(25)} ${path.substring(0, 20).padEnd(20)} ${cat.governor.substring(0, 25).padEnd(25)} ${(cat.childCount || 0).toString().padEnd(9)} ${cat.thingCount || 0}${status}`
    );
  }

  console.log(`\nTotal: ${categories.length} category/ies`);
}

function showCategory(args, deployment) {
  const categoryId = args.category;

  if (!categoryId) {
    console.error('Error: --category <id> required');
    return;
  }

  const category = deployment.registry.categories.find(c => c.entryId === categoryId);
  if (!category) {
    console.error(`Error: Category ${categoryId} not found`);
    return;
  }

  const path = buildCategoryPath(deployment.registry, categoryId);
  const children = getChildren(deployment.registry, categoryId);
  const things = (deployment.registry.things || []).filter(t => t.categoryId === categoryId);

  console.log('\n========================================================================');
  console.log(`  CATEGORY: ${category.name}`);
  console.log('========================================================================\n');

  console.log(`  ID:           ${category.entryId}`);
  console.log(`  Path:         ${path}`);
  console.log(`  Status:       ${category.active ? 'Active' : 'Inactive'}`);
  console.log(`  Governor:     ${category.governor}`);
  console.log(`  Delegates:    ${category.delegates.length > 0 ? category.delegates.join(', ') : 'None'}`);
  console.log(`  Spec Hash:    ${category.specHash}`);
  console.log(`  Created:      ${formatDate(category.createdAtTime)}`);

  if (children.length > 0) {
    console.log('\n  CHILDREN:');
    for (const child of children) {
      const status = child.active ? '' : ' (inactive)';
      console.log(`    - ${child.name}${status} (${child.entryId})`);
    }
  }

  if (things.length > 0) {
    console.log('\n  THINGS:');
    for (const thing of things.slice(0, 10)) {
      console.log(`    - ${thing.instanceId} owned by ${thing.owner}`);
    }
    if (things.length > 10) {
      console.log(`    ... and ${things.length - 10} more`);
    }
  }
}

function showTree(deployment) {
  const registry = deployment.registry;
  const roots = registry.categories.filter(c => !c.parent);

  console.log('\n=== Category Tree ===\n');

  function printTree(categoryId, indent = '') {
    const cat = registry.categories.find(c => c.entryId === categoryId);
    if (!cat) return;

    const status = cat.active ? '' : ' [INACTIVE]';
    const thingCount = cat.thingCount > 0 ? ` (${cat.thingCount} things)` : '';
    console.log(`${indent}${cat.name}${status}${thingCount}`);

    const children = getChildren(registry, categoryId);
    for (let i = 0; i < children.length; i++) {
      const isLast = i === children.length - 1;
      const childIndent = indent + (isLast ? '  ' : '| ');
      const prefix = isLast ? '\\-' : '|-';
      console.log(`${indent}${prefix}`);
      printTree(children[i].entryId, childIndent);
    }
  }

  for (const root of roots) {
    printTree(root.entryId, '');
    console.log('');
  }
}

function registerThing(args, deployment) {
  const categoryId = args.category;
  const metadata = args.metadata;
  const location = args.location || 'sierra_nevada';
  const carbonImpact = parseFloat(args['impact-carbon']) || 0;
  const waterImpact = parseFloat(args['impact-water']) || 0;
  const bioImpact = parseFloat(args['impact-bio']) || 0;
  const userName = args.user;

  if (!categoryId) {
    console.error('Error: --category is required');
    return;
  }

  const category = deployment.registry.categories.find(c => c.entryId === categoryId);
  if (!category) {
    console.error(`Error: Category ${categoryId} not found`);
    return;
  }

  if (!category.active) {
    console.error('Error: Cannot register thing under inactive category');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  if (!canRegister(pnft.level)) {
    console.error(`Error: ${pnft.level} level cannot register things. Need Verified or Steward.`);
    return;
  }

  const slot = getCurrentSlot();
  const metadataHash = metadata || crypto.randomBytes(16).toString('hex');

  const thing = {
    instanceId: generateThingId(),
    categoryId: categoryId,
    categoryPath: buildCategoryPath(deployment.registry, categoryId),
    owner: pnft.id,
    location: location,
    origin: null,  // No origin for initial registration
    impact: {
      carbon_net: carbonImpact,
      water_net: waterImpact,
      biodiversity_net: bioImpact,
      steps: 0,
      proof_refs: [],
    },
    metadataHash: metadataHash,
    createdAt: slot,
    createdAtTime: new Date().toISOString(),
    transformationHistory: [],
  };

  deployment.registry.things.push(thing);
  category.thingCount = (category.thingCount || 0) + 1;

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                       THING REGISTERED                                 ');
  console.log('========================================================================\n');

  console.log(`  Instance ID:    ${thing.instanceId}`);
  console.log(`  Category:       ${thing.categoryPath}`);
  console.log(`  Owner:          ${pnft.id}`);
  console.log(`  Location:       ${location}`);
  console.log(`  Metadata:       ${metadataHash}`);
  console.log(`\n  Impact Summary:`);
  console.log(`    Carbon:       ${carbonImpact} kg CO2e`);
  console.log(`    Water:        ${waterImpact} L`);
  console.log(`    Biodiversity: ${bioImpact}`);
}

function transform(args, deployment) {
  const inputIds = args.inputs?.split(',').map(s => s.trim()) || [];
  const processId = args.process;
  const outputCategory = args['output-category'];
  const metadata = args.metadata;
  const carbonImpact = parseFloat(args['impact-carbon']) || 0;
  const waterImpact = parseFloat(args['impact-water']) || 0;
  const bioImpact = parseFloat(args['impact-bio']) || 0;
  const userName = args.user;

  if (inputIds.length === 0 || !outputCategory) {
    console.error('Error: --inputs and --output-category are required');
    return;
  }

  // Verify all inputs exist and get owner
  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const inputThings = [];
  for (const inputId of inputIds) {
    const thing = deployment.registry.things.find(t => t.instanceId === inputId);
    if (!thing) {
      console.error(`Error: Input thing ${inputId} not found`);
      return;
    }
    if (thing.owner !== pnft.id) {
      console.error(`Error: You do not own input thing ${inputId}`);
      return;
    }
    inputThings.push(thing);
  }

  const outCategory = deployment.registry.categories.find(c => c.entryId === outputCategory);
  if (!outCategory) {
    console.error(`Error: Output category ${outputCategory} not found`);
    return;
  }

  // Aggregate impacts from inputs + transformation impact
  let totalCarbon = carbonImpact;
  let totalWater = waterImpact;
  let totalBio = bioImpact;
  let maxSteps = 0;
  const proofRefs = [];

  for (const input of inputThings) {
    totalCarbon += input.impact.carbon_net;
    totalWater += input.impact.water_net;
    totalBio += input.impact.biodiversity_net;
    maxSteps = Math.max(maxSteps, input.impact.steps);
    proofRefs.push(...(input.impact.proof_refs || []));
  }

  const slot = getCurrentSlot();
  const metadataHash = metadata || crypto.randomBytes(16).toString('hex');

  const newThing = {
    instanceId: generateThingId(),
    categoryId: outputCategory,
    categoryPath: buildCategoryPath(deployment.registry, outputCategory),
    owner: pnft.id,
    location: inputThings[0].location,
    origin: {
      inputs: inputIds,
      processId: processId || 'unspecified',
      transformer: pnft.id,
      transformedAt: slot,
    },
    impact: {
      carbon_net: totalCarbon,
      water_net: totalWater,
      biodiversity_net: totalBio,
      steps: maxSteps + 1,
      proof_refs: proofRefs,
    },
    metadataHash: metadataHash,
    createdAt: slot,
    createdAtTime: new Date().toISOString(),
    transformationHistory: inputIds,
  };

  // Mark inputs as transformed (consumed)
  for (const input of inputThings) {
    input.transformedInto = newThing.instanceId;
    input.transformedAt = new Date().toISOString();
  }

  deployment.registry.things.push(newThing);
  outCategory.thingCount = (outCategory.thingCount || 0) + 1;

  saveDeployment(deployment);

  console.log('\n========================================================================');
  console.log('                      TRANSFORMATION COMPLETE                           ');
  console.log('========================================================================\n');

  console.log(`  New Instance:   ${newThing.instanceId}`);
  console.log(`  Category:       ${newThing.categoryPath}`);
  console.log(`  Inputs:         ${inputIds.join(', ')}`);
  console.log(`  Process:        ${processId || 'unspecified'}`);
  console.log(`  Transformer:    ${pnft.id}`);
  console.log(`\n  Aggregated Impact (${newThing.impact.steps} steps):`);
  console.log(`    Carbon:       ${totalCarbon} kg CO2e`);
  console.log(`    Water:        ${totalWater} L`);
  console.log(`    Biodiversity: ${totalBio}`);
}

function transferThing(args, deployment) {
  const thingId = args.thing;
  const toPnft = args.to;
  const userName = args.user;

  if (!thingId || !toPnft) {
    console.error('Error: --thing and --to are required');
    return;
  }

  const thing = deployment.registry.things.find(t => t.instanceId === thingId);
  if (!thing) {
    console.error(`Error: Thing ${thingId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft || pnft.id !== thing.owner) {
    console.error('Error: Only the owner can transfer this thing');
    return;
  }

  const newOwner = deployment.pnfts?.find(p => p.id === toPnft);
  if (!newOwner) {
    console.error(`Error: pNFT ${toPnft} not found`);
    return;
  }

  const previousOwner = thing.owner;
  thing.owner = toPnft;
  thing.transferredAt = new Date().toISOString();

  saveDeployment(deployment);

  console.log(`\nThing ${thingId} transferred from ${previousOwner} to ${toPnft}`);
}

function updateThingMetadata(args, deployment) {
  const thingId = args.thing;
  const metadata = args.metadata;
  const userName = args.user;

  if (!thingId || !metadata) {
    console.error('Error: --thing and --metadata are required');
    return;
  }

  const thing = deployment.registry.things.find(t => t.instanceId === thingId);
  if (!thing) {
    console.error(`Error: Thing ${thingId} not found`);
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft || pnft.id !== thing.owner) {
    console.error('Error: Only the owner can update metadata');
    return;
  }

  thing.metadataHash = metadata;
  thing.updatedAt = new Date().toISOString();

  saveDeployment(deployment);

  console.log(`\nMetadata updated for thing ${thingId}`);
}

function listThings(args, deployment) {
  let things = deployment.registry.things || [];
  const categoryFilter = args.category;
  const ownerFilter = args.owner;
  const locationFilter = args.location;

  if (categoryFilter) {
    things = things.filter(t => t.categoryId === categoryFilter);
  }
  if (ownerFilter) {
    things = things.filter(t => t.owner === ownerFilter);
  }
  if (locationFilter) {
    things = things.filter(t => t.location === locationFilter);
  }

  console.log('\n=== Registered Things ===\n');

  if (things.length === 0) {
    console.log('  No things found.');
    return;
  }

  console.log('INSTANCE ID              CATEGORY                 OWNER                     IMPACT (C/W/B)');
  console.log('-'.repeat(100));

  for (const thing of things) {
    const impact = `${thing.impact.carbon_net}/${thing.impact.water_net}/${thing.impact.biodiversity_net}`;
    const transformed = thing.transformedInto ? ' [TRANSFORMED]' : '';
    console.log(
      `${thing.instanceId.padEnd(24)} ${thing.categoryPath.substring(0, 24).padEnd(24)} ${thing.owner.substring(0, 25).padEnd(25)} ${impact}${transformed}`
    );
  }

  console.log(`\nTotal: ${things.length} thing(s)`);
}

function showThing(args, deployment) {
  const thingId = args.thing;

  if (!thingId) {
    console.error('Error: --thing <id> required');
    return;
  }

  const thing = deployment.registry.things.find(t => t.instanceId === thingId);
  if (!thing) {
    console.error(`Error: Thing ${thingId} not found`);
    return;
  }

  console.log('\n========================================================================');
  console.log(`  THING: ${thing.instanceId}`);
  console.log('========================================================================\n');

  console.log(`  Category:       ${thing.categoryPath}`);
  console.log(`  Owner:          ${thing.owner}`);
  console.log(`  Location:       ${thing.location}`);
  console.log(`  Created:        ${formatDate(thing.createdAtTime)}`);
  console.log(`  Metadata:       ${thing.metadataHash}`);

  if (thing.transformedInto) {
    console.log(`\n  STATUS: TRANSFORMED into ${thing.transformedInto}`);
  }

  console.log('\n  IMPACT SUMMARY');
  console.log('  --------------');
  console.log(`  Carbon:         ${thing.impact.carbon_net} kg CO2e`);
  console.log(`  Water:          ${thing.impact.water_net} L`);
  console.log(`  Biodiversity:   ${thing.impact.biodiversity_net}`);
  console.log(`  Chain Steps:    ${thing.impact.steps}`);

  if (thing.origin) {
    console.log('\n  ORIGIN (Transformation)');
    console.log('  -----------------------');
    console.log(`  Inputs:         ${thing.origin.inputs.join(', ')}`);
    console.log(`  Process:        ${thing.origin.processId}`);
    console.log(`  Transformer:    ${thing.origin.transformer}`);
  } else {
    console.log('\n  ORIGIN: Primary registration (no transformation)');
  }
}

function traceThing(args, deployment) {
  const thingId = args.thing;

  if (!thingId) {
    console.error('Error: --thing <id> required');
    return;
  }

  const thing = deployment.registry.things.find(t => t.instanceId === thingId);
  if (!thing) {
    console.error(`Error: Thing ${thingId} not found`);
    return;
  }

  console.log('\n=== Transformation Trace ===\n');

  function traceback(instanceId, depth = 0) {
    const item = deployment.registry.things.find(t => t.instanceId === instanceId);
    if (!item) {
      console.log('  '.repeat(depth) + `[${instanceId}] NOT FOUND`);
      return;
    }

    const indent = '  '.repeat(depth);
    console.log(`${indent}[${item.instanceId}] ${item.categoryPath}`);
    console.log(`${indent}  Impact: C=${item.impact.carbon_net} W=${item.impact.water_net} B=${item.impact.biodiversity_net}`);

    if (item.origin && item.origin.inputs.length > 0) {
      console.log(`${indent}  Process: ${item.origin.processId}`);
      console.log(`${indent}  From:`);
      for (const inputId of item.origin.inputs) {
        traceback(inputId, depth + 2);
      }
    } else {
      console.log(`${indent}  [ORIGIN POINT]`);
    }
  }

  traceback(thingId);
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = parseArgs(process.argv.slice(2));
  const deployment = loadDeployment();

  if (args.help || Object.keys(args).length === 0) {
    showHelp();
    return;
  }

  // Registry commands
  if (args.bootstrap) {
    bootstrap(deployment);
    return;
  }

  if (args['create-root']) {
    createRoot(args, deployment);
    return;
  }

  if (args['create-child']) {
    createChild(args, deployment);
    return;
  }

  if (args['add-delegate']) {
    addDelegate(args, deployment);
    return;
  }

  if (args['remove-delegate']) {
    removeDelegate(args, deployment);
    return;
  }

  if (args['update-spec']) {
    updateSpec(args, deployment);
    return;
  }

  if (args['transfer-governance']) {
    transferGovernance(args, deployment);
    return;
  }

  if (args.deactivate) {
    deactivate(args, deployment);
    return;
  }

  if (args['list-categories']) {
    listCategories(args, deployment);
    return;
  }

  if (args.show && args.category) {
    showCategory(args, deployment);
    return;
  }

  if (args.tree) {
    showTree(deployment);
    return;
  }

  // Thing commands
  if (args['register-thing']) {
    registerThing(args, deployment);
    return;
  }

  if (args.transform) {
    transform(args, deployment);
    return;
  }

  if (args['transfer-thing']) {
    transferThing(args, deployment);
    return;
  }

  if (args['update-metadata']) {
    updateThingMetadata(args, deployment);
    return;
  }

  if (args['list-things']) {
    listThings(args, deployment);
    return;
  }

  if (args.show && args.thing) {
    showThing(args, deployment);
    return;
  }

  if (args.trace && args.thing) {
    traceThing(args, deployment);
    return;
  }

  showHelp();
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

main();
