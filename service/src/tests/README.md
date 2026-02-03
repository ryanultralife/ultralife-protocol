# UltraLife MCP Service Test Suite

Comprehensive test suite for the UltraLife Model Context Protocol service.

## Test Files

### 1. `mcp.test.ts` - MCP Handler Tests

Tests all 14 MCP tool handlers with mock data:

**Information Tools:**
- `get_ultralife_info` - Protocol information retrieval
- `get_protocol_stats` - Aggregated statistics

**pNFT Tools:**
- `get_pnft` - Retrieve pNFT by ID
- `get_pnft_by_address` - Find pNFT by wallet address
- `get_token_balance` - Get token balance for pNFT
- `list_pnfts` - List pNFTs with filters

**Bioregion Tools:**
- `list_bioregions` - List all bioregions
- `get_bioregion` - Get bioregion details

**Land Tools:**
- `get_land` - Retrieve land by ID
- `list_lands` - List lands with filters

**Marketplace Tools:**
- `list_offerings` - List marketplace offerings
- `list_needs` - List care/needs

**Transaction Tools:**
- `list_transactions` - List transactions with filters

**Sequestration Credits:**
- `get_sequestration_credits` - Get credit information

### 2. `indexer.test.ts` - Simulation Indexer Tests

Tests the simulation indexer functionality:

- **Initialization**: Loading deployment.json, error handling
- **Caching Behavior**: Hot reload verification
- **Data Queries**: All indexer query methods
- **pNFT Queries**: getPnft, getPnftByOwner, listPnfts
- **Token Balances**: Balance queries and calculations
- **Bioregion Queries**: Bioregion data and statistics
- **Offering/Need Queries**: Marketplace data access
- **Collective Queries**: Collective data retrieval
- **Protocol Stats**: Aggregated statistics
- **Land Queries**: Land data access
- **Credit Balances**: Credit balance queries
- **Impact Debt**: Debt tracking queries
- **Spending Buckets**: Bucket management
- **Treasury**: Bonding curve and treasury state
- **Transactions**: Transaction history
- **Error Handling**: Graceful degradation

### 3. `integration.test.ts` - Integration Tests

Tests the full MCP server flow:

- **Server Initialization**: Server startup and configuration
- **Tool Registration**: Verify all tools are registered
- **Request/Response Cycle**: End-to-end tool execution
- **LOCAL_MODE Behavior**: Local mode specific functionality
- **Error Handling**: Error responses and validation
- **Data Consistency**: Cross-tool referential integrity
- **Filter and Pagination**: Query parameter handling
- **Protocol Spec Integration**: Protocol spec usage

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- mcp.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="pNFT Tools"
```

## Test Data

Tests use mock data structures that mirror the real deployment.json format:

- **pNFTs**: Sample personal identity NFTs
- **Lands**: Test land parcels with sequestration data
- **Bioregions**: Test bioregions with statistics
- **Transactions**: Sample transaction records
- **Marketplace**: Test offerings and needs
- **Credits**: Sequestration credit data
- **Balances**: Token and credit balances

## Coverage Goals

- **Unit Tests**: 80%+ coverage for handlers
- **Integration Tests**: All MCP tools tested
- **Error Handling**: All error paths tested

## Test Structure

Each test file follows this structure:

1. **Mock Data Setup**: Define test fixtures
2. **Test Setup/Teardown**: Initialize handlers, cleanup
3. **Test Suites**: Grouped by functionality
4. **Assertions**: Verify expected behavior

## Writing New Tests

When adding new MCP tools or handlers:

1. Add mock data to test fixtures
2. Create test cases in appropriate file
3. Test both success and error cases
4. Verify LOCAL_MODE behavior
5. Update this README

## Debugging Tests

```bash
# Run tests with verbose output
npm test -- --verbose

# Run single test
npm test -- -t "should handle get_pnft"

# Debug with node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

## CI/CD Integration

Tests are designed to run in CI environments:

- No external dependencies required
- All data is mocked
- Fast execution (< 10 seconds total)
- Clean setup/teardown

## Common Issues

### Module Resolution Errors

If you encounter module resolution errors, ensure:
- `jest.config.js` has correct `moduleNameMapper`
- TypeScript paths are configured correctly
- ES module support is enabled

### Mock Data Issues

If tests fail due to data inconsistencies:
- Verify deployment.json structure matches fixtures
- Check that all required fields are present
- Ensure referential integrity in test data

### Timeout Errors

If tests timeout:
- Increase timeout in jest.config.js
- Check for async operations without await
- Verify no infinite loops in handlers

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing TypeScript](https://jestjs.io/docs/getting-started#via-ts-jest)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
