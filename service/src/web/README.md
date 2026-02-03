# UltraLife Protocol Specification API

A lightweight web server for serving the UltraLife Protocol specification and deployment data.

## Features

- RESTful API for protocol specification
- Compound and validator lookups
- Deployment state tracking
- CORS support for cross-origin requests
- Gzip compression
- Optional rate limiting
- Health check endpoint
- Comprehensive error handling

## Installation

```bash
cd /home/user/ultralife-protocol/service
npm install
```

## Running the Server

### Development Mode
```bash
npm run serve
```

### Production Mode
```bash
# Build first
npm run build

# Then run
npm run serve:prod
```

### With Custom Port
```bash
PORT=8080 npm run serve
```

### With Rate Limiting
```bash
ENABLE_RATE_LIMIT=true RATE_LIMIT=100 RATE_WINDOW=60000 npm run serve
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `CORS_ORIGIN` | `*` | CORS allowed origins |
| `NODE_ENV` | - | Environment (development/production) |
| `ENABLE_RATE_LIMIT` | `false` | Enable rate limiting |
| `RATE_LIMIT` | `100` | Max requests per window |
| `RATE_WINDOW` | `60000` | Rate limit window (ms) |

## API Endpoints

### Root - Protocol Info
```bash
GET /
```

Returns protocol information and available endpoints.

**Example:**
```bash
curl http://localhost:3000/
```

**Response:**
```json
{
  "protocol": "UltraLife",
  "version": "1.0.0",
  "description": "Impact-tracked economy on Cardano...",
  "endpoints": {
    "spec": {...},
    "compounds": {...},
    ...
  }
}
```

---

### Full Protocol Specification
```bash
GET /spec
```

Returns the complete protocol-spec.json file.

**Example:**
```bash
curl http://localhost:3000/spec
```

**Response:**
```json
{
  "protocol": "UltraLife",
  "version": "1.0.0",
  "compounds": {...},
  "confidence_levels": {...},
  ...
}
```

---

### List All Compounds
```bash
GET /spec/compounds
```

Returns a flattened list of all compound definitions across categories.

**Example:**
```bash
curl http://localhost:3000/spec/compounds
```

**Response:**
```json
{
  "total": 67,
  "categories": [
    "environmental",
    "nutritional",
    "health",
    ...
  ],
  "compounds": [
    {
      "code": "CO2",
      "category": "environmental",
      "name": "Carbon Dioxide",
      "unit": "g",
      "direction": "negative = emission",
      "example": "-450 for 200g beef transport"
    },
    ...
  ]
}
```

---

### Get Specific Compound
```bash
GET /spec/compounds/:id
```

Returns details for a specific compound by code.

**Example:**
```bash
curl http://localhost:3000/spec/compounds/CO2
curl http://localhost:3000/spec/compounds/IRON
curl http://localhost:3000/spec/compounds/GLYPHOSATE
```

**Response:**
```json
{
  "code": "CO2",
  "category": "environmental",
  "name": "Carbon Dioxide",
  "unit": "g",
  "direction": "negative = emission",
  "example": "-450 for 200g beef transport"
}
```

---

### List All Validators
```bash
GET /spec/validators
```

Returns all available validators.

**Example:**
```bash
curl http://localhost:3000/spec/validators
```

**Response:**
```json
{
  "total": 4,
  "validators": [
    {
      "id": "compound-flow",
      "name": "Compound Flow Validator",
      "description": "Validates compound flows in transactions...",
      "fields": ["compound", "quantity", "unit", "measurement", "confidence"]
    },
    ...
  ]
}
```

---

### Get Specific Validator
```bash
GET /spec/validators/:id
```

Returns details for a specific validator.

**Example:**
```bash
curl http://localhost:3000/spec/validators/compound-flow
curl http://localhost:3000/spec/validators/transaction
curl http://localhost:3000/spec/validators/land-sequestration
curl http://localhost:3000/spec/validators/confidence-level
```

**Response:**
```json
{
  "id": "compound-flow",
  "name": "Compound Flow Validator",
  "description": "Validates compound flows...",
  "onChainTypes": {...},
  "measurementMethods": [...],
  "confidenceLevels": {...},
  "examples": {...}
}
```

---

### Deployment State
```bash
GET /deployment
```

Returns current deployment state if available (from scripts/deployment.json).

**Example:**
```bash
curl http://localhost:3000/deployment
```

**Response:**
```json
{
  "summary": {
    "testUsers": 2,
    "pnfts": 2,
    "lands": 1,
    "transactions": 4,
    "bioregions": 1,
    "totalUltraBalance": 100,
    "sequestrationCredits": 1,
    "creditPurchases": 1
  },
  "details": {...},
  "lastUpdated": "2026-02-03T20:00:00.000Z"
}
```

---

### Health Check
```bash
GET /health
```

Returns server health status.

**Example:**
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-03T20:00:00.000Z",
  "services": {
    "protocolSpec": {
      "loaded": true,
      "version": "1.0.0"
    },
    "deployment": {
      "loaded": true,
      "testMode": true
    }
  },
  "uptime": 3600,
  "memory": {
    "used": 45,
    "total": 128,
    "unit": "MB"
  }
}
```

## Error Responses

### 404 Not Found
```json
{
  "error": "Not found",
  "path": "/invalid",
  "availableEndpoints": [...]
}
```

### 400 Bad Request
```json
{
  "error": "Invalid compound ID",
  "details": [...]
}
```

### 429 Rate Limit Exceeded
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An error occurred"
}
```

## Deployment

### Vercel

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Create `vercel.json` in the service directory:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/web/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/web/index.js"
    }
  ]
}
```

3. Deploy:
```bash
npm run build
vercel --prod
```

### Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Create `railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run serve:prod",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

3. Deploy:
```bash
railway login
railway init
railway up
```

### Fly.io

1. Install Fly CLI:
```bash
curl -L https://fly.io/install.sh | sh
```

2. Create `fly.toml`:
```toml
app = "ultralife-spec-api"
primary_region = "sjc"

[build]
  builder = "paketobuildpacks/builder:base"
  buildpacks = ["gcr.io/paketo-buildpacks/nodejs"]

[env]
  PORT = "8080"
  NODE_ENV = "production"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

3. Deploy:
```bash
fly launch
fly deploy
```

### Docker

1. Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY protocol-spec.json ./
COPY scripts/deployment.json ./scripts/

ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/web/index.js"]
```

2. Build and run:
```bash
npm run build
docker build -t ultralife-api .
docker run -p 3000:3000 ultralife-api
```

## Usage Examples

### JavaScript/TypeScript
```typescript
// Fetch all compounds
const response = await fetch('http://localhost:3000/spec/compounds');
const data = await response.json();
console.log(`Total compounds: ${data.total}`);

// Get specific compound
const co2 = await fetch('http://localhost:3000/spec/compounds/CO2');
const co2Data = await co2.json();
console.log(`${co2Data.name}: ${co2Data.description}`);
```

### Python
```python
import requests

# Get protocol spec
response = requests.get('http://localhost:3000/spec')
spec = response.json()
print(f"Protocol: {spec['protocol']} v{spec['version']}")

# Get compound
compound = requests.get('http://localhost:3000/spec/compounds/IRON')
print(compound.json())
```

### cURL
```bash
# Pretty print JSON
curl -s http://localhost:3000/spec/compounds/CO2 | jq

# Get all environmental compounds
curl -s http://localhost:3000/spec | jq '.compounds.environmental'

# Check health
curl -s http://localhost:3000/health | jq '.status'
```

## CORS Configuration

The server supports CORS for cross-origin requests. By default, all origins are allowed. To restrict origins:

```bash
CORS_ORIGIN=https://ultralife.earth npm run serve
```

For multiple origins, use a comma-separated list and modify the code:
```typescript
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['*'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));
```

## Performance

- **Caching**: Protocol spec is loaded once at startup and cached in memory
- **Compression**: Gzip compression enabled for all responses
- **Rate Limiting**: Optional rate limiting to prevent abuse
- **Deployment cache**: 5-second TTL to balance freshness and performance

## Monitoring

The `/health` endpoint can be used for monitoring:

```bash
# Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

# Uptime monitoring
*/5 * * * * curl -f http://localhost:3000/health || exit 1
```

## Security

- All endpoints are read-only (GET only)
- Input validation with Zod
- Error messages don't expose sensitive information in production
- Optional rate limiting
- CORS configuration

## License

MIT

## Links

- Protocol Repository: https://github.com/ultralife-protocol/spec
- Protocol Documentation: https://ultralife.earth
- Cardano Network: https://cardano.org
