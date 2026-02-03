# UltraLife MCP Service - Testing Guide

Comprehensive test suite for the UltraLife Model Context Protocol service.

## Quick Start

```bash
# Install dependencies (includes Jest and testing tools)
npm install

# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Suite Overview

The test suite consists of 2,273 lines of comprehensive tests across three main files:

### 1. MCP Handler Tests (`mcp.test.ts`)
**835 lines** - Tests all 14 MCP tool handlers

Tests each handler with:
- Valid inputs and expected outputs
- Error handling for invalid inputs
- Filter and pagination behavior
- Data enrichment (balances, relationships)
- LOCAL_MODE marking

**Handlers Tested:**
- Information: `get_ultralife_info`, `get_protocol_stats`
- pNFTs: `get_pnft`, `get_pnft_by_address`, `get_token_balance`, `list_pnfts`
- Bioregions: `list_bioregions`, `get_bioregion`
- Lands: `get_land`, `list_lands`
- Marketplace: `list_offerings`, `list_needs`
- Transactions: `list_transactions`
- Credits: `get_sequestration_credits`

### 2. Simulation Indexer Tests (`indexer.test.ts`)
**764 lines** - Tests the simulation indexer

Comprehensive coverage of:
- Initialization and error handling
- Hot reload behavior (data refreshes on each query)
- All query methods (pNFTs, bioregions, lands, etc.)
- Token balance calculations
- Treasury and bonding curve simulation
- Transaction history filtering
- Impact debt tracking
- Credit balance management
- Graceful error handling

### 3. Integration Tests (`integration.test.ts`)
**674 lines** - End-to-end server tests

Tests the complete MCP server flow:
- Server initialization with various configs
- All 14 tool request/response cycles
- Error handling and validation
- LOCAL_MODE behavior verification
- Data consistency across tools
- Filter and pagination across all list operations
- Protocol spec integration
- Hot reload in production use

## Test Data

Tests use realistic mock data that mirrors production `deployment.json`:

```javascript
// Example mock data structure
{
  testUsers: [...],      // Sample users
  pnfts: [...],         // Personal identity NFTs
  ultraBalances: {...}, // Token balances
  lands: [...],         // Land parcels
  bioregionStats: {...}, // Bioregion statistics
  transactions: [...],  // Transaction history
  marketplace: [...],   // Offerings
  care: [...],          // Needs
  sequestrationCredits: [...], // Carbon credits
  // ... and more
}
```

## Running Specific Tests

```bash
# Run a specific test file
npm test -- mcp.test.ts
npm test -- indexer.test.ts
npm test -- integration.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="pNFT Tools"
npm test -- --testNamePattern="get_pnft"

# Run a single test suite
npm test -- --testNamePattern="Information Tools"
```

## Test Coverage

```bash
# Generate coverage report
npm run test:coverage

# Coverage will be output to:
# - Terminal (summary)
# - coverage/lcov-report/index.html (detailed HTML report)
```

**Coverage Goals:**
- Handler functions: 80%+ coverage
- Indexer queries: 90%+ coverage
- Integration paths: 100% of tools tested

## Test Structure

Each test file follows this pattern:

```typescript
// 1. Mock data setup
const MOCK_DATA = { ... };

// 2. Test lifecycle hooks
beforeAll(async () => {
  // Setup test environment
  // Write mock files
  // Initialize handlers
});

afterAll(() => {
  // Cleanup test files
});

// 3. Test suites grouped by functionality
describe('Feature Group', () => {
  describe('Specific Feature', () => {
    it('should handle expected case', () => {
      // Test implementation
      expect(result).toBeDefined();
    });

    it('should handle error case', () => {
      // Error testing
      expect(result).toHaveProperty('error');
    });
  });
});
```

## Configuration Files

### `jest.config.js`
Jest configuration with TypeScript and ES modules support:
- Uses ts-jest preset for ESM
- Handles .ts files with proper module resolution
- Configured for 10-second test timeout
- Coverage reporting enabled

### `package.json`
Updated with:
```json
{
  "scripts": {
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
    "test:watch": "npm test -- --watch",
    "test:coverage": "npm test -- --coverage"
  },
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2"
  }
}
```

## Test Environment

Tests create temporary directories for mock data:
- `.test-temp/` - MCP handler tests
- `.test-temp-indexer/` - Indexer tests
- `.test-temp-integration/` - Integration tests

These are automatically cleaned up after tests complete.

## Debugging Tests

### Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test
```bash
npm test -- -t "should retrieve pNFT by ID"
```

### Debug with Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open Chrome DevTools and navigate to `chrome://inspect`

### Check Test Execution Time
```bash
npm test -- --verbose --testTimeout=30000
```

## Continuous Integration

Tests are designed for CI/CD:
- No external dependencies (no blockchain, no APIs)
- All data is mocked
- Fast execution (< 10 seconds total)
- Clean setup and teardown
- Exit codes indicate pass/fail

### Example CI Configuration

**GitHub Actions:**
```yaml
- name: Run Tests
  run: |
    npm install
    npm test

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Common Issues

### Module Resolution Errors
**Problem:** `Cannot find module` errors

**Solution:** Ensure dependencies are installed:
```bash
npm install
```

### TypeScript Compilation Errors
**Problem:** Type errors in tests

**Solution:** Check that @types/jest is installed and tsconfig includes test files

### Mock Data Inconsistencies
**Problem:** Tests fail due to missing fields in mock data

**Solution:** Verify mock data structure matches the DeploymentData interface

### Timeout Errors
**Problem:** Tests timeout after 5 seconds

**Solution:** Increase timeout in jest.config.js or use `--testTimeout` flag

## Writing New Tests

When adding new MCP tools:

1. **Add to mcp.test.ts:**
   - Create mock data for the new tool
   - Add test cases in appropriate describe block
   - Test success and error cases
   - Verify LOCAL_MODE marking

2. **Add to integration.test.ts:**
   - Add tool to request handling tests
   - Test with filters and pagination
   - Verify consistency with other tools

3. **Update mock data:**
   - Add required fields to MOCK_DEPLOYMENT_DATA
   - Ensure referential integrity
   - Update all relevant test files

4. **Run tests:**
   ```bash
   npm test -- --verbose
   ```

## Test Metrics

Current test suite statistics:
- **Total Lines:** 2,273
- **Test Files:** 3
- **Test Suites:** 40+
- **Individual Tests:** 150+
- **MCP Tools Covered:** 14/14 (100%)
- **Indexer Methods:** 30+ methods tested

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing TypeScript with Jest](https://jestjs.io/docs/getting-started#via-ts-jest)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Test Coverage Best Practices](https://jestjs.io/docs/configuration#collectcoveragefrom-array)

## Getting Help

If you encounter issues:

1. Check this guide and `src/tests/README.md`
2. Review test output for specific error messages
3. Verify all dependencies are installed
4. Check that deployment.json structure matches expectations
5. Run with `--verbose` flag for detailed output

## Next Steps

After running tests successfully:

1. Review coverage report: `open coverage/lcov-report/index.html`
2. Add tests for any new features
3. Maintain 80%+ coverage for new code
4. Integrate tests into CI/CD pipeline
5. Run tests before committing changes
