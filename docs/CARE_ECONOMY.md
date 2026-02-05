# Care Economy

## Overview

The UltraLife Care Economy recognizes and rewards invisible labor - the work that enables all other work. Childcare, elder care, household management, and community service form the foundation of economic activity, yet traditional economics ignores them.

UltraLife changes this by:
1. Recording care work on-chain
2. Accumulating care credits
3. Boosting UBI calculations
4. Building community reputation
5. Generating positive social impact

## Care Credit Mechanics

### Credit Generation

Care credits are earned by providing documented and attested care work.

**Formula:**
```
credits_earned = hours * credits_per_hour * care_type_multiplier * attestation_bonus
```

**Components:**
| Component | Description |
|-----------|-------------|
| hours | Verified hours of care provided |
| credits_per_hour | Base rate (default: 10) |
| care_type_multiplier | Adjustment by care intensity |
| attestation_bonus | Bonus for high-quality attestation |

### Care Type Multipliers

| Care Type | Multiplier | Rationale |
|-----------|------------|-----------|
| Childcare - Infant | 1.5x | High intensity, constant attention |
| Childcare - Toddler | 1.4x | High activity, supervision |
| Childcare - Preschool | 1.2x | Active engagement |
| Childcare - School Age | 1.0x | Standard supervision |
| Childcare - Adolescent | 1.1x | Emotional complexity |
| ElderCare - Independent | 0.8x | Check-ins, companionship |
| ElderCare - Assisted | 1.2x | Daily activity assistance |
| ElderCare - Full Time | 1.5x | Significant daily care |
| ElderCare - Medical | 1.8x | Medical care needs |
| ElderCare - Palliative | 2.0x | End-of-life care |
| DisabilityCare | 1.3x | Specialized support |
| HealthSupport | 1.2x | Recovery assistance |
| Household | 0.8x | Household management |
| CommunityService | 1.0x | Volunteer work |
| FamilySupport | 1.0x | Emotional/financial guidance |

### Attestation Bonus

Higher quality attestations earn bonus credits:

| Attestation Level | Bonus |
|-------------------|-------|
| Recipient Attests | +10% |
| Family Member Attests | +5% |
| Neighbor Attests | +5% |
| Healthcare Professional | +15% |
| Social Worker | +15% |
| Multiple Attestors (3+) | +20% |

**Maximum Bonus:** 40%

### Example Calculation

```
Scenario: Childcare for infant, 20 hours, attested by recipient and neighbor

Base:       20 hours * 10 credits = 200 credits
Multiplier: 200 * 1.5 (infant) = 300 credits
Bonus:      300 * 1.15 (recipient + neighbor) = 345 credits

Total Credits Earned: 345
```

## Care Types

### 1. Childcare

```
Type: Childcare
  Age Groups:
    - Infant (0-1)
    - Toddler (1-3)
    - Preschool (3-5)
    - SchoolAge (5-12)
    - Adolescent (12-18)

  Activities:
    - Feeding
    - Bathing
    - Supervision
    - Education
    - Healthcare
    - Transportation
    - EmotionalSupport
    - PlayAndDevelopment
```

**Example Registration:**
```bash
npm run care:register -- \
  --type Childcare \
  --age-group Infant \
  --activities "Feeding,Supervision,PlayAndDevelopment" \
  --hours-per-week 15 \
  --description "Daily care for newborn nephew"
```

### 2. Elder Care

```
Type: ElderCare
  Care Levels:
    - Independent: Mostly self-sufficient, check-ins
    - Assisted: Help with some daily activities
    - FullTime: Significant daily assistance
    - Medical: Medical care needs
    - Palliative: End-of-life care

  Activities:
    - Companionship
    - MealPreparation
    - Medication
    - Mobility
    - PersonalCare
    - Transportation
    - HouseholdHelp
    - MedicalAppointments
```

**Example Registration:**
```bash
npm run care:register -- \
  --type ElderCare \
  --care-level Assisted \
  --activities "MealPreparation,Medication,Transportation" \
  --hours-per-week 10 \
  --description "Caring for elderly neighbor Mrs. Johnson"
```

### 3. Disability Care

```
Type: DisabilityCare
  Support Types:
    - PhysicalAssistance
    - CognitiveSupport
    - SensoryAssistance
    - MentalHealthSupport
    - DailyLivingSupport
    - Advocacy
```

### 4. Health Support

```
Type: HealthSupport
  Support Types:
    - PostSurgery
    - ChronicCondition
    - MentalHealth
    - Recovery
    - Prenatal
    - Postnatal
```

### 5. Household

```
Type: Household
  Activities:
    - Cleaning
    - Cooking
    - Laundry
    - Shopping
    - BudgetManagement
    - HomeRepairs
    - Gardening
    - PetCare

  Multiplier: Based on household_size
    - 1-2 people: 0.6x
    - 3-4 people: 0.8x
    - 5+ people: 1.0x
```

### 6. Community Service

```
Type: CommunityService
  Service Types:
    - Volunteering
    - MutualAid
    - Neighborhood
    - Emergency
    - Environmental
    - Educational
    - Cultural
    - Religious
```

### 7. Family Support

```
Type: FamilySupport
  Support Types:
    - EmotionalSupport
    - FinancialGuidance
    - ConflictResolution
    - CrisisIntervention
    - Mentoring
    - Advocacy
```

## Exchange Rates

### Care Credits to UBI

Care credits boost UBI distributions:

```
UBI_Boost = min(care_credits * 0.1, max_boost)

Where:
  max_boost = 50% of base UBI
```

**Example:**
```
Base UBI: 100 ULTRA
Care Credits: 300
UBI Boost: min(300 * 0.1, 50) = 30 ULTRA

Total UBI Received: 130 ULTRA
```

### Care Credits to ULTRA (Direct Conversion)

Care credits can be converted directly:

```
ULTRA = care_credits * exchange_rate * bioregion_factor

Where:
  exchange_rate = 0.05 (default)
  bioregion_factor = based on local care shortage
```

**Bioregion Factors:**
| Shortage Level | Factor |
|---------------|--------|
| Surplus | 0.8x |
| Balanced | 1.0x |
| Shortage | 1.2x |
| Critical Shortage | 1.5x |

### Care-to-Care Exchange

Care providers can exchange services directly:

```
1 hour childcare = 1.5 hours elder care (independent)
1 hour childcare = 0.75 hours medical elder care
1 hour community service = 1.2 hours household work
```

## Workflow: Need to Credits

### Complete Care Flow

```
1. NEED REGISTRATION
   │
   ├── Recipient or family registers need
   ├── Specifies care type, hours needed, location
   └── Need enters matching pool

2. MATCHING
   │
   ├── Caregivers browse available needs
   ├── System suggests matches based on:
   │   ├── Proximity
   │   ├── Skills/experience
   │   ├── Schedule compatibility
   │   └── Past ratings
   └── Caregiver expresses interest

3. ACCEPTANCE
   │
   ├── Recipient reviews caregiver profile
   ├── Accepts or declines
   └── Care assignment created

4. CARE PROVISION
   │
   ├── Caregiver tracks hours worked
   ├── Records activities performed
   └── Notes any significant events

5. VERIFICATION
   │
   ├── Recipient attests care was provided
   ├── Family members may add attestation
   ├── Neighbors/witnesses may attest
   └── Minimum attestations required (2)

6. CREDIT GENERATION
   │
   ├── Hours verified against attestations
   ├── Credits calculated with multipliers
   ├── Credits added to caregiver record
   └── Care record marked complete

7. CREDIT APPLICATION
   │
   ├── Credits applied to UBI boost
   ├── OR converted to ULTRA
   ├── OR exchanged for other care
   └── Reputation updated
```

### CLI Workflow Example

```bash
# Step 1: Recipient registers need
npm run care:register -- \
  --type Childcare \
  --age-group Toddler \
  --hours-per-week 20 \
  --description "Need afternoon care for 2-year-old"

# Step 2: Caregiver browses needs
npm run care:list -- --bioregion sierra_nevada --type Childcare

# Step 3: Caregiver offers to fulfill
npm run care:fulfill -- --need <need_id> --hours 10

# Step 4: Recipient accepts
npm run care:accept -- --assignment <assignment_id>

# Step 5: Track care hours
npm run care:track -- \
  --assignment <assignment_id> \
  --hours 5 \
  --notes "Feeding, play, nap supervision"

# Step 6: Complete care period
npm run care:complete -- --assignment <assignment_id>

# Step 7: View credits
npm run care:my
```

## Attestation Requirements

### Minimum Attestations

| Care Type | Min. Attestors | Required Roles |
|-----------|---------------|----------------|
| Childcare | 2 | Parent OR Guardian + 1 other |
| ElderCare | 2 | Recipient (if able) OR Family + 1 other |
| DisabilityCare | 2 | Recipient OR Guardian + Professional |
| HealthSupport | 2 | Recipient + Healthcare provider |
| Household | 1 | Household member |
| CommunityService | 2 | Organization + Beneficiary |
| FamilySupport | 2 | Recipient + Witness |

### Attestor Roles

| Role | Who | Weight |
|------|-----|--------|
| Recipient | Person receiving care | 1.0 |
| RecipientFamily | Family of care recipient | 0.8 |
| NeighborAttestor | Neighbor who observed | 0.6 |
| CommunityMember | Community witness | 0.5 |
| HealthProfessional | Doctor, nurse, etc. | 1.2 |
| SocialWorker | Licensed social worker | 1.2 |

### Attestation Quality Score

```
quality_score = sum(attestor_weight * confidence) / attestor_count

If quality_score >= 0.8: Full credits
If quality_score >= 0.6: 80% credits
If quality_score >= 0.4: 60% credits
If quality_score < 0.4: No credits (needs more attestation)
```

## Anti-Gaming Protections

### Daily Hour Limits

```
max_daily_hours = 16
max_weekly_hours = 84

Per care type per day:
  Childcare: 12 hours max
  ElderCare: 16 hours max
  DisabilityCare: 16 hours max
  HealthSupport: 12 hours max
  Household: 8 hours max
  CommunityService: 8 hours max
  FamilySupport: 6 hours max
```

### Cooldown Periods

```
Between care claim submissions: 4 hours minimum
Between credit conversions: 24 hours minimum
Between UBI applications: 1 epoch (37 days)
```

### Attestor Requirements

- Attestors must have Standard+ verification level
- Attestors cannot attest for same caregiver more than 3x per cycle
- Self-attestation is never valid
- Reciprocal attestation flagged for review

### Pattern Detection

```
Flags for review:
  - Same attestor pattern repeated
  - Unusual hour distributions
  - Geographic impossibility
  - Sudden large credit claims
  - Circular care exchanges
```

## Integration with Other Systems

### UBI Integration

```javascript
// ubi_calculation.mjs
function calculateUBI(pnft, baseAmount, careCreditRecord) {
  // Base UBI amount
  let ubi = baseAmount;

  // Care credit boost
  const careBoost = Math.min(
    careCreditRecord.unapplied_credits * 0.1,
    baseAmount * 0.5 // Max 50% boost
  );

  ubi += careBoost;

  // Update care credits
  careCreditRecord.credits_applied += careBoost / 0.1;

  return {
    amount: ubi,
    base: baseAmount,
    care_boost: careBoost,
    remaining_credits: careCreditRecord.total_credits - careCreditRecord.credits_applied,
  };
}
```

### Impact System Integration

Care work generates positive social impact:

```
Impact Type: Social_Wellbeing
Impact Magnitude: care_hours * social_impact_rate

social_impact_rate by care_type:
  Childcare: 2.0 per hour
  ElderCare: 1.8 per hour
  DisabilityCare: 2.2 per hour
  HealthSupport: 1.5 per hour
  CommunityService: 1.0 per hour
```

### Reputation System

Care work builds community reputation:

```
reputation_points = credits_earned * reputation_factor

reputation_factor by attestation_quality:
  High (0.8+): 1.5x
  Medium (0.6-0.8): 1.0x
  Low (0.4-0.6): 0.5x
```

## Configuration Parameters

```javascript
// care_config.mjs
export const CARE_CONFIG = {
  // Credit rates
  credits_per_hour: 10,
  max_daily_hours: 16,
  max_weekly_hours: 84,

  // Attestation
  min_attestations: 2,
  attestation_validity_days: 7,

  // Multipliers
  care_type_multipliers: {
    Childcare_Infant: 1.5,
    Childcare_Toddler: 1.4,
    Childcare_Preschool: 1.2,
    Childcare_SchoolAge: 1.0,
    Childcare_Adolescent: 1.1,
    ElderCare_Independent: 0.8,
    ElderCare_Assisted: 1.2,
    ElderCare_FullTime: 1.5,
    ElderCare_Medical: 1.8,
    ElderCare_Palliative: 2.0,
    DisabilityCare: 1.3,
    HealthSupport: 1.2,
    Household: 0.8,
    CommunityService: 1.0,
    FamilySupport: 1.0,
  },

  // UBI integration
  ubi_credit_rate: 0.1,
  max_ubi_boost_percent: 50,

  // Direct conversion
  ultra_exchange_rate: 0.05,

  // Cooldowns (in slots)
  claim_cooldown: 14400,      // ~4 hours
  conversion_cooldown: 86400, // ~24 hours
  ubi_cooldown: 3196800,      // ~37 days (1 cycle)

  // Anti-gaming
  max_attestor_uses_per_cycle: 3,
  pattern_detection_threshold: 0.8,
};
```

## Reporting and Analytics

### Caregiver Dashboard

```
npm run care:my

Output:
----------------------------------------
CARE ECONOMY DASHBOARD
----------------------------------------

Caregiver: Alice (pnft_abc123...)
Level: Verified

CREDITS SUMMARY:
  Total Earned: 2,450 credits
  Applied to UBI: 1,800 credits
  Converted to ULTRA: 500 credits
  Available: 150 credits

THIS CYCLE (Cycle 47):
  Hours Worked: 45
  Credits Earned: 520
  Care Types:
    - Childcare: 30 hrs (390 credits)
    - ElderCare: 15 hrs (130 credits)

ACTIVE ASSIGNMENTS:
  1. Childcare for Johnson Family
     Status: Active | Hours: 15/week
     Started: Slot 150,000,000

  2. ElderCare for Mr. Williams
     Status: Active | Hours: 8/week
     Started: Slot 148,500,000

PENDING ATTESTATIONS: 2
  - ElderCare session (Dec 15)
  - Childcare session (Dec 18)

REPUTATION SCORE: 87/100
  - Quality Rating: 4.8/5
  - Reliability: 95%
  - Community Endorsements: 12
----------------------------------------
```

### Bioregion Care Statistics

```
npm run care:stats -- --bioregion sierra_nevada

Output:
----------------------------------------
BIOREGION CARE STATISTICS
Bioregion: Sierra Nevada
Cycle: 47
----------------------------------------

ACTIVE CAREGIVERS: 342
CARE RECIPIENTS: 1,247

CARE HOURS THIS CYCLE:
  Childcare: 12,450 hours
  ElderCare: 8,230 hours
  DisabilityCare: 2,100 hours
  HealthSupport: 1,850 hours
  Household: 3,400 hours
  CommunityService: 5,200 hours

CREDITS DISTRIBUTED: 287,500

CARE GAPS:
  - ElderCare (Medical): HIGH DEMAND
  - Childcare (Infant): MODERATE DEMAND
  - DisabilityCare: BALANCED

BIOREGION FACTOR: 1.2 (Shortage)
----------------------------------------
```

## Summary

The Care Economy:

1. **Recognizes** invisible labor that sustains communities
2. **Rewards** care providers with credits and reputation
3. **Verifies** care through community attestation
4. **Integrates** with UBI for boosted distributions
5. **Protects** against gaming through multiple mechanisms
6. **Scales** across bioregions with local factors

Care work is no longer invisible. Every hour of care strengthens the community and earns recognition in the UltraLife economy.
