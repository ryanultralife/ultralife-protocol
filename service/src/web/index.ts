import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import {
  getProtocolSpec,
  getCompounds,
  getCompoundById,
  getValidators,
  getValidatorById,
  getDeploymentState,
  getHealthCheck,
} from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Create Express app
const app: Express = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  credentials: true,
}));

app.use(compression());
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Simple rate limiting (optional, basic implementation)
if (process.env.ENABLE_RATE_LIMIT === 'true') {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT = parseInt(process.env.RATE_LIMIT || '100', 10);
  const RATE_WINDOW = parseInt(process.env.RATE_WINDOW || '60000', 10); // 1 minute

  app.use((req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
      next();
    } else if (record.count < RATE_LIMIT) {
      record.count++;
      next();
    } else {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      });
    }
  });

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of requestCounts.entries()) {
      if (now > record.resetTime) {
        requestCounts.delete(ip);
      }
    }
  }, 300000);
}

// Routes

// Root - Protocol info and available endpoints
app.get('/', (req: Request, res: Response) => {
  res.json({
    protocol: 'UltraLife',
    version: '1.0.0',
    description: 'Impact-tracked economy on Cardano. Every transaction measures compound flows.',
    endpoints: {
      spec: {
        path: '/spec',
        description: 'Full protocol specification',
      },
      compounds: {
        path: '/spec/compounds',
        description: 'List all compound categories',
      },
      compound: {
        path: '/spec/compounds/:id',
        description: 'Get specific compound by ID',
        example: '/spec/compounds/CO2',
      },
      validators: {
        path: '/spec/validators',
        description: 'List all validators',
      },
      validator: {
        path: '/spec/validators/:id',
        description: 'Get specific validator',
        example: '/spec/validators/compound-flow',
      },
      deployment: {
        path: '/deployment',
        description: 'Current deployment state',
      },
      health: {
        path: '/health',
        description: 'Health check endpoint',
      },
    },
    docs: 'https://github.com/ultralife-protocol/spec',
    source: 'https://github.com/ultralife-protocol',
  });
});

// Protocol specification
app.get('/spec', getProtocolSpec);

// Compounds
app.get('/spec/compounds', getCompounds);
app.get('/spec/compounds/:id', getCompoundById);

// Validators
app.get('/spec/validators', getValidators);
app.get('/spec/validators/:id', getValidatorById);

// Deployment state
app.get('/deployment', getDeploymentState);

// Health check
app.get('/health', getHealthCheck);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    availableEndpoints: [
      '/',
      '/spec',
      '/spec/compounds',
      '/spec/compounds/:id',
      '/spec/validators',
      '/spec/validators/:id',
      '/deployment',
      '/health',
    ],
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
});

// Start server
const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

app.listen(portNumber, HOST as string, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║  UltraLife Protocol Specification Server                 ║
║                                                           ║
║  Server running at: http://${HOST}:${portNumber}${' '.repeat(Math.max(0, 22 - String(HOST).length - String(portNumber).length))}║
║                                                           ║
║  Endpoints:                                               ║
║    GET /              - Protocol info                     ║
║    GET /spec          - Full specification                ║
║    GET /spec/compounds - All compounds                    ║
║    GET /spec/validators - All validators                  ║
║    GET /deployment    - Deployment state                  ║
║    GET /health        - Health check                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
