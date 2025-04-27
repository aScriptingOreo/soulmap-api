import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

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

// Enhanced CORS configuration for SSE support
app.use(cors({
  origin: function(origin, callback) {
    callback(null, true);
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
app.use('/api/admin', authenticateAdmin, adminRouter);

// Add dedicated CORS preflight for SSE endpoint
app.options('/api/listen', cors({
  origin: '*',
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

const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  });

export { app, server };
