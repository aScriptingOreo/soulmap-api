import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import dotenv from 'dotenv';
dotenv.config();

// Manually set critical environment variables if missing
process.env.discord_bot_secret = process.env.discord_bot_secret || '6jmwho18OmZzlnkLVyaStMQmfiBDRo6k';

// Log environment variables for debugging
console.log('Environment variables loaded:', {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  discord_bot_id: process.env.discord_bot_id,
  discord_bot_secret: process.env.discord_bot_secret ? '[PRESENT]' : '[MISSING]',
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
});

// Import routers
import locationsRouter from './routes/locations.js';
import heatmapRouter from './routes/heatmap.js';
import listenRouter from './routes/listen.js';  // Use the correct import name
import eventsRouter from './routes/events.js';  // For backward compatibility
import statusRouter from './routes/status.js';
import adminRouter from './routes/admin.js';
import { authenticateAdmin } from './middleware/auth.js';

const app = express();
const server = createServer(app);

// Get domain from environment for CORS configuration
const domain = process.env.DOMAIN || 'localhost';
console.log(`Server starting with domain: ${domain}`);

// Add environment variables logging at startup
console.log('Starting server with environment variables:');
console.log('- DOMAIN:', process.env.DOMAIN);
console.log('- DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID);
console.log('- discord_bot_id:', process.env.discord_bot_id);
console.log('- DISCORD_REDIRECT_URI:', process.env.DISCORD_REDIRECT_URI);

// Enhanced CORS configuration with specific origins
app.use(cors({
  origin: function (origin, callback) {
    // In production, only allow specific origins
    const allowedOrigins = [
      `https://${domain}`,
      `http://${domain}`,
      `https://dev.${domain}`, // Dev server
      `http://dev.${domain}`, // Dev server
      `https://soulmap.7thseraph.org`,
      `http://soulmap.7thseraph.org`,
      'http://localhost:5173', // Dev server
      'http://localhost:5170', // Admin dev server
      undefined, // Allow requests with no origin (like mobile apps, curl, etc)
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection']
}));

app.use(express.json());

// Mount the routers - all with /api prefix
app.use('/api/locations', locationsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/listen', listenRouter);  // Primary SSE endpoint
app.use('/api/events', eventsRouter);  // Legacy routes for compatibility
app.use('/api/status', statusRouter);

// IMPORTANT: Auth routes must be defined BEFORE protected routes
// Public auth endpoint - update path to match exact router definition
app.use('/api/admin/auth', express.json(), adminRouter);

// AFTER auth routes, add the protected routes with authentication middleware
app.use('/api/admin', authenticateAdmin, adminRouter);  // Protected admin routes

// Add dedicated CORS preflight for SSE endpoint
app.options('/api/listen', cors({
  origin: [
    `https://${domain}`,
    `http://${domain}`,
    'http://localhost:5173',
    'http://localhost:5170',
    undefined
  ],
  methods: ['GET'],
  credentials: true,
  maxAge: 86400, // 1 day in seconds
}));

// Health route at root level
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Also add API health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Assets folder for images, tiles, etc.
app.use('/assets', express.static('public/assets'));

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export { app, server };
