# UltraLife Protocol API - Quick Start

## Installation & Setup

```bash
cd /home/user/ultralife-protocol/service
npm install
```

## Start the Server

### Development Mode (with hot reload)
```bash
npm run serve
```

### Production Mode
```bash
npm run build
npm run serve:prod
```

## Test the API

```bash
# Run automated tests
./src/web/test-api.sh

# Or test manually
curl http://localhost:3000/health
curl http://localhost:3000/spec/compounds/CO2 | jq
```

## Quick Examples

### Get all compounds
```bash
curl -s http://localhost:3000/spec/compounds | jq '.total'
# Returns: 65
```

### Get specific compound
```bash
curl -s http://localhost:3000/spec/compounds/GLYPHOSATE | jq
# Returns compound details with name, unit, note, etc.
```

### Get validators
```bash
curl -s http://localhost:3000/spec/validators | jq '.validators[].name'
```

### Get deployment state
```bash
curl -s http://localhost:3000/deployment | jq '.summary'
```

## Configuration

Create `.env` file (see `.env.example`):
```bash
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=*
ENABLE_RATE_LIMIT=false
```

## What's Included

- **Full Protocol Spec**: Complete protocol-spec.json served via REST API
- **Compound Lookup**: Query any of 65+ compounds by code
- **Validator Info**: Access validation rules and examples
- **Deployment State**: Live deployment data from testnet
- **Health Check**: Monitor service availability
- **CORS Support**: Cross-origin requests enabled
- **Compression**: Gzip compression for faster responses
- **Rate Limiting**: Optional rate limiting (disabled by default)
- **Error Handling**: Proper HTTP status codes and error messages

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Protocol info and available endpoints |
| `GET /spec` | Full protocol specification |
| `GET /spec/compounds` | List all compounds (65 total) |
| `GET /spec/compounds/:id` | Get specific compound (e.g., CO2, IRON, GLYPHOSATE) |
| `GET /spec/validators` | List all validators |
| `GET /spec/validators/:id` | Get specific validator |
| `GET /deployment` | Current deployment state |
| `GET /health` | Health check |

## Example Usage

### JavaScript/TypeScript
```typescript
const response = await fetch('http://localhost:3000/spec/compounds/CO2');
const compound = await response.json();
console.log(compound.name); // "Carbon Dioxide"
```

### Python
```python
import requests
response = requests.get('http://localhost:3000/spec/compounds/IRON')
print(response.json()['name'])  # "Iron"
```

### curl
```bash
# Get compound info
curl http://localhost:3000/spec/compounds/CO2 | jq

# Check server health
curl http://localhost:3000/health

# Get all environmental compounds
curl http://localhost:3000/spec | jq '.compounds.environmental'
```

## Next Steps

1. **Deploy**: See README.md for deployment instructions (Vercel, Railway, Fly.io)
2. **Customize**: Modify routes.ts to add custom endpoints
3. **Monitor**: Use /health endpoint for monitoring
4. **Scale**: Enable rate limiting in production

## Files Created

- `/service/src/web/index.ts` - Main Express server
- `/service/src/web/routes.ts` - Route handlers with validation
- `/service/src/web/README.md` - Full documentation
- `/service/src/web/QUICKSTART.md` - This file
- `/service/src/web/.env.example` - Configuration template
- `/service/src/web/test-api.sh` - Automated test suite

## Troubleshooting

**Server won't start:**
```bash
# Check if port is in use
lsof -i :3000

# Use different port
PORT=8080 npm run serve
```

**Can't find protocol-spec.json:**
- Server looks for `/home/user/ultralife-protocol/protocol-spec.json`
- Make sure you're running from the correct directory

**Rate limiting not working:**
- Set `ENABLE_RATE_LIMIT=true` in .env
- Adjust `RATE_LIMIT` and `RATE_WINDOW` as needed

## Support

- Documentation: See README.md for detailed docs
- Protocol Spec: https://github.com/ultralife-protocol/spec
- Issues: Report issues on GitHub
