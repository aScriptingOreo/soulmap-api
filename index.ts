import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import db from '#db';  // Use #db instead of relative import
import { ensureHeatmapTablesExist } from './src/utils/dbMigration.js';

// Import routers
import locationsRouter from './src/routes/locations.js';
import heatmapRouter from './src/routes/heatmap.js';
import listenRouter, { broadcastToAll } from './src/routes/listen.js';
import statusRouter from './src/routes/status.js';
import adminRouter from './src/routes/admin.js';
import { authenticateAdmin } from './src/middleware/auth.js';

// Import events router for backward compatibility
import eventsRouter from './src/routes/events.js';

const app = express();
const server = createServer(app);
const PORT = process.env.SERVER_PORT || 3000;

// Enhanced CORS configuration for SSE support
app.use(cors({
  origin: function(origin, callback) {
    // In Docker environment, allow all origins
    // Security is handled at the network level
    callback(null, true);
  },
  credentials: true,
  exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection']
}));

app.use(express.json());

// Add environment variables for Discord authentication
app.use((req, res, next) => {
  // Set environment variables for Discord auth if not already set
  process.env.DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID || '1309555440102674513';
  process.env.DISCORD_ADMIN_ROLE_ID = process.env.DISCORD_ADMIN_ROLE_ID || '1309700533749289012';
  process.env.DISCORD_MANAGER_ROLE_ID = process.env.DISCORD_MANAGER_ROLE_ID || '1363588579506262056';
  next();
});

// Mount the routers - all with /api prefix
app.use('/api/locations', locationsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/listen', listenRouter);  // Primary SSE endpoint
app.use('/api/events', eventsRouter);  // Legacy SSE endpoint for compatibility
app.use('/api/status', statusRouter);  // Status includes health check
app.use('/api/admin', authenticateAdmin, adminRouter); // Protected admin routes

// Health route at root level for easy access
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Also add API health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// Add dedicated CORS preflight for SSE endpoint
app.options('/api/listen', cors({
  origin: '*',
  methods: ['GET'],
  credentials: true,
  maxAge: 86400, // 1 day in seconds
}));

// Setup database change listener with proper error handling
async function setupDatabaseListener() {
  try {
    await db.setupListener('location_changes', (payload) => {
      // Broadcast to all connected clients
      const data = JSON.stringify({
        type: 'change',
        data: JSON.parse(payload),
        timestamp: Date.now()
      });
      
      broadcastToAll(data);
      
      console.log(`Broadcast change to clients:`, payload);
    }).catch(error => {
      console.error('Database listener setup failed:', error.message);
      console.log('Server will continue without database change notifications');
    });
    
    console.log('Database change listener setup complete');
  } catch (error) {
    console.error('Error setting up database listener:', error);
    console.log('Server will continue without database change notifications');
  }
}

// Ensure database tables exist
async function ensureDatabaseTablesExist() {
  try {
    console.log("Ensuring required database tables exist...");
    
    // Ensure heatmap tables exist
    const result = await ensureHeatmapTablesExist();
    
    if (result.success) {
      console.log("Database tables check completed successfully");
    } else {
      console.warn("Database tables check completed with warnings:", result.message);
    }
  } catch (error) {
    console.error("Failed to ensure database tables exist:", error);
    console.log("Server will continue, but some features may not work correctly");
  }
}

// Start server
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API endpoints available at: http://localhost:${PORT}/api/`);
  
  // First, ensure database tables exist
  await ensureDatabaseTablesExist();
    
  // Then try to set up database listener
  try {
    await setupDatabaseListener();
  } catch (error) {
    console.warn('Database listener could not be initialized:', error.message);
    console.log('Server will continue without real-time updates');
  }
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  // Exit process
  process.exit(0);
});
