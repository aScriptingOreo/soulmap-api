import express from 'express';
import db from '#db';  // Use database wrapper for consistent handling
import fetch from 'node-fetch';

console.log('Admin router file loaded.');

const router = express.Router();

// Discord API configuration - use exact env var names from .env
const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID || '1309555440102674513';
const DISCORD_ADMIN_ROLE_ID = process.env.DISCORD_ADMIN_ROLE_ID || '1309700533749289012';
const DISCORD_MANAGER_ROLE_ID = process.env.DISCORD_MANAGER_ROLE_ID || '1363588579506262056';

// CRITICAL: Use the exact variable names from .env file
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_BOT_ID = process.env.DISCORD_BOT_ID;
const DISCORD_BOT_SECRET = process.env.DISCORD_BOT_SECRET;
// Fix how we handle the DISCORD_REDIRECT_URI - don't use template literals directly
let DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';

// If DISCORD_REDIRECT_URI contains ${DOMAIN}, manually replace it
if (DISCORD_REDIRECT_URI.includes('${DOMAIN}')) {
  DISCORD_REDIRECT_URI = DISCORD_REDIRECT_URI.replace('${DOMAIN}', process.env.DOMAIN || 'soulmap.7thseraph.org');
}

// If still not a valid URL, use a hardcoded default
if (!DISCORD_REDIRECT_URI.match(/^https?:\/\/[^\/]+\//)) {
  DISCORD_REDIRECT_URI = `https://${process.env.DOMAIN || 'soulmap.7thseraph.org'}/admin/auth/callback`;
}

// Log OAuth configuration for debugging
console.log('Discord OAuth Configuration (using exact .env variable names):');
console.log('- Bot/Client ID:', DISCORD_BOT_ID);
console.log('- Bot Secret:', DISCORD_BOT_SECRET ? '[PRESENT]' : '[MISSING]');
console.log('- Bot Token:', DISCORD_BOT_TOKEN ? '[PRESENT]' : '[MISSING]');
console.log('- Redirect URI:', DISCORD_REDIRECT_URI);
console.log('- Original Redirect URI from .env:', process.env.DISCORD_REDIRECT_URI);
console.log('- Domain used:', process.env.DOMAIN);

// Add middleware to log all requests to this router
router.use((req, res, next) => {
  console.log(`Admin route hit: ${req.method} ${req.originalUrl}`);
  next();
});

// IMPORTANT: The admin router is mounted at both /api/admin and /api/admin/auth
// So we need to ensure paths are correct based on how they're mounted
// For Auth endpoints (mounted at /api/admin/auth), we should use / as the base path
// For Admin endpoints (mounted at /api/admin), we should use /locations, /categories, etc.

/**
 * Token validation endpoint - this handles both auth code and Bearer token validation
 * For path mounted at /api/admin/auth
 */
router.post('/validate', async (req, res) => {
  console.log('Token validation request received');
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ valid: false, message: 'Token is required' });
  }

  // Determine if this is an auth code (exchange) or access token (validation)
  const isAuthCode = token.length < 50 && !token.startsWith('ey');

  console.log(`Processing token as ${isAuthCode ? 'auth code' : 'access token'}`);
  console.log('Request headers:', {
    origin: req.headers.origin,
    referer: req.headers.referer,
    host: req.headers.host,
  });

  try {
    let accessToken = token;

    // If this is an auth code, exchange it for an access token first
    if (isAuthCode) {
      console.log('Exchanging auth code for access token');

      // Use DISCORD_BOT_SECRET from the environment
      if (!DISCORD_BOT_SECRET) {
        console.error('ERROR: Discord bot secret is missing - cannot complete OAuth flow');
        console.log('Available env vars:', Object.keys(process.env).filter(k => k.startsWith('DISCORD')).join(', '));
        return res.status(500).json({
          valid: false,
          message: 'Server configuration error: Discord bot secret not available',
          details: 'The server is missing DISCORD_BOT_SECRET environment variable'
        });
      }

      // Use the pre-processed, valid redirect URI - don't try to process it again
      const redirectUri = DISCORD_REDIRECT_URI;

      // Verify the redirect URI is valid before sending to Discord
      if (!redirectUri.match(/^https?:\/\/[^\/]+\//)) {
        console.error('ERROR: Invalid redirect URI format:', redirectUri);
        return res.status(500).json({
          valid: false,
          message: 'Server configuration error: Invalid redirect URI format',
          details: 'The redirect URI is not properly formatted as a valid URL'
        });
      }

      // Log the token exchange parameters for debugging
      console.log('Token Exchange Parameters:');
      console.log('- Client ID:', DISCORD_BOT_ID);
      console.log('- Client Secret:', DISCORD_BOT_SECRET ? '✓ Available' : '✗ Missing');
      console.log('- Redirect URI:', redirectUri);
      console.log('- Domain from env:', process.env.DOMAIN);

      // Create the form data with validated parameters from .env variables
      const formData = new URLSearchParams({
        client_id: DISCORD_BOT_ID,
        client_secret: DISCORD_BOT_SECRET,
        grant_type: 'authorization_code',
        code: token,
        redirect_uri: redirectUri
      });

      console.log('Exchange payload (sanitized):', formData.toString().replace(/client_secret=([^&]+)/, 'client_secret=[REDACTED]'));

      const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });

      // Log the raw token response status
      console.log(`Token exchange response status: ${tokenResponse.status}`);

      if (!tokenResponse.ok) {
        let errorDetails = '';
        try {
          const errorData = await tokenResponse.text();
          errorDetails = errorData;
          console.error('Token exchange failed:', tokenResponse.status, errorData);
        } catch (e) {
          errorDetails = `Failed to read response body: ${e.message}`;
        }

        return res.status(401).json({
          valid: false,
          message: 'Failed to exchange code for token',
          details: errorDetails
        });
      }

      const tokenData = await tokenResponse.json();
      accessToken = tokenData.access_token;
      console.log('Successfully exchanged auth code for access token');
    }

    // Fetch user information from Discord using the access token
    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userResponse.ok) {
      console.error('Discord user info request failed:', userResponse.status);
      return res.status(401).json({
        valid: false,
        message: 'Invalid Discord token'
      });
    }

    const user = await userResponse.json();
    console.log(`User info received for: ${user.username}`);

    // SIMPLIFIED APPROACH: Directly check roles using the bot token
    if (!DISCORD_BOT_TOKEN) {
      return res.status(500).json({
        valid: false,
        message: 'Server configuration error: Bot token not available'
      });
    }

    // Use the bot token to check if user is in the server and has required roles
    const memberResponse = await fetch(`${DISCORD_API}/guilds/${DISCORD_SERVER_ID}/members/${user.id}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` }
    });

    if (!memberResponse.ok) {
      if (memberResponse.status === 404) {
        return res.status(403).json({
          valid: false,
          message: 'User is not a member of the required server'
        });
      }

      return res.status(500).json({
        valid: false,
        message: 'Failed to verify server membership'
      });
    }

    const memberData = await memberResponse.json();
    const memberRoles = memberData.roles || [];

    // Check if user has admin or manager role
    const hasRequiredRole = memberRoles.includes(DISCORD_ADMIN_ROLE_ID) ||
      memberRoles.includes(DISCORD_MANAGER_ROLE_ID);

    if (!hasRequiredRole) {
      return res.status(403).json({
        valid: false,
        message: 'Insufficient permissions: Required role not found'
      });
    }

    // User is authenticated and authorized
    console.log('Authentication successful');

    // Return the access token so the client can use it for future requests
    return res.json({
      valid: true,
      token: accessToken, // Include the access token for future API calls
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
        discriminator: user.discriminator,
        isAdmin: true,
        roles: memberRoles
      }
    });

  } catch (error) {
    console.error('Error validating Discord token:', error);
    return res.status(500).json({
      valid: false,
      message: 'Internal server error during validation',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * Get all locations - Admin version
 * For path mounted at /api/admin
 */
router.get('/locations', async (req, res) => {
  try {
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const locations = await prisma.location.findMany({
      orderBy: {
        lastModified: 'desc'
      }
    });

    console.log(`Fetched ${locations.length} locations for admin`);
    res.json(locations);
  } catch (error) {
    console.error('Error fetching admin locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

/**
 * Get all unique location categories
 */
router.get('/categories', async (req, res) => {
  try {
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // Use Prisma findMany with distinct for better type safety and reliability
    const uniqueCategoryObjects = await prisma.location.findMany({
      distinct: ['type'],
      select: {
        type: true,
      },
      orderBy: {
        type: 'asc',
      },
    });

    // Extract the type values from the results WITHOUT modifying them
    const categories = uniqueCategoryObjects.map(item => item.type);

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * Get a single location by ID
 */
router.get('/locations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const location = await prisma.location.findUnique({
      where: { id },
    });
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

/**
 * Create a new location
 */
router.post('/locations', async (req, res) => {
  console.log('POST /locations handler reached.'); // Add this log
  // Ensure coordinates are handled correctly
  const { coordinates, ...restData } = req.body;

  const data = { ...restData };

  // Handle coordinates based on your schema (assuming JSON for flexibility)
  if (coordinates && Array.isArray(coordinates)) {
    data.coordinates = coordinates;
  } else {
    // Provide a default if coordinates are missing or invalid
    data.coordinates = [[0, 0]];
  }

  // Add default values or handle missing optional fields if necessary
  data.iconSize = data.iconSize ?? 1;
  data.iconColor = data.iconColor ?? '#ffffff';
  data.radius = data.radius ?? 0;
  data.mediaUrl = data.mediaUrl ?? [];
  data.isCoordinateSearch = data.isCoordinateSearch ?? false;
  data.noCluster = data.noCluster ?? false;
  data.exactCoordinates = data.exactCoordinates ?? null;
  // You might want to set submittedBy/approvedBy based on the authenticated user here

  try {
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const newLocation = await prisma.location.create({
      data,
    });
    console.log('Location created successfully:', newLocation.id); // Add success log
    res.status(201).json(newLocation); // Use 201 Created status
  } catch (error) {
    console.error('Error creating location:', error.message || error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

/**
 * Create a new location (dedicated endpoint)
 */
router.post('/locations/new', async (req, res) => {
  console.log('POST /locations/new handler reached.'); // Log for debugging

  // Ensure coordinates are handled correctly
  const { coordinates, ...restData } = req.body;

  const data = { ...restData };

  // Handle coordinates based on your schema
  if (coordinates && Array.isArray(coordinates)) {
    data.coordinates = coordinates;
  } else {
    // Provide a default if coordinates are missing or invalid
    data.coordinates = [[0, 0]];
  }

  // Add default values or handle missing optional fields
  data.iconSize = data.iconSize ?? 1;
  data.iconColor = data.iconColor ?? '#ffffff';
  data.radius = data.radius ?? 0;
  data.mediaUrl = data.mediaUrl ?? [];
  data.isCoordinateSearch = data.isCoordinateSearch ?? false;
  data.noCluster = data.noCluster ?? false;
  data.exactCoordinates = data.exactCoordinates ?? null;

  try {
    console.log('Creating new location with data:', data);
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const newLocation = await prisma.location.create({
      data,
    });
    console.log('Location created successfully:', newLocation.id);
    res.status(201).json(newLocation);
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

/**
 * Update a location by ID
 */
router.put('/locations/:id', async (req, res) => {
  const { id } = req.params;
  // Ensure coordinates are handled correctly if they are part of the update
  const { coordinates, ...restData } = req.body;

  const data = { ...restData };

  // Prisma expects coordinates in a specific format if it's a Point type.
  // If your schema uses simple arrays or JSON, adjust accordingly.
  // Assuming 'coordinates' might be sent and needs potential transformation:
  if (coordinates && Array.isArray(coordinates)) {
    // If your schema expects a JSON field or similar:
    // data.coordinates = coordinates; 

    // If your schema expects separate lat/lon or x/y fields, map them here.
    // Example for separate fields:
    // if (coordinates.length === 2) {
    //   data.latitude = coordinates[1]; // Assuming [lon, lat] or [x, y]
    //   data.longitude = coordinates[0];
    // }

    // If using PostGIS Point type, Prisma might handle array directly or need specific structure.
    // Consult Prisma docs for your specific database type (e.g., PostGIS).
    // For now, let's assume it's handled directly or stored as JSON/Array
    data.coordinates = coordinates;
  }

  try {
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data,
    });
    res.json(updatedLocation);
  } catch (error) {
    // Log the specific Prisma error if available
    console.error('Error updating location:', error.message || error);
    // Check for specific Prisma errors like P2025 (Record not found)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Location not found for update' });
    }
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * Delete a location by ID
 */
router.delete('/locations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    await prisma.location.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

/**
 * HEATMAP MANAGEMENT ENDPOINTS
 * These endpoints provide CRUD operations for heatmap types and datapoints
 */

// Get all heatmap types
router.get('/heatmap/types', async (req, res) => {
  try {
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const types = await prisma.heatmapType.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    res.json(types);
  } catch (error) {
    console.error('Error fetching heatmap types:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap types' });
  }
});

// Create a new heatmap type
router.post('/heatmap/types', async (req, res) => {
  try {
    const { name, intensity, colorBindings } = req.body;
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const newType = await prisma.heatmapType.create({
      data: {
        name,
        intensity,
        colorBindings
      }
    });

    res.status(201).json(newType);
  } catch (error) {
    console.error('Error creating heatmap type:', error);

    // Check for unique constraint error
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A heatmap type with this name already exists' });
    }

    res.status(500).json({ error: 'Failed to create heatmap type' });
  }
});

// Update a heatmap type
router.put('/heatmap/types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, intensity, colorBindings } = req.body;
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const updatedType = await prisma.heatmapType.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(name !== undefined && { name }),
        ...(intensity !== undefined && { intensity }),
        ...(colorBindings !== undefined && { colorBindings })
      }
    });

    res.json(updatedType);
  } catch (error) {
    console.error('Error updating heatmap type:', error);

    // Check for Prisma not found error
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Heatmap type not found for update' });
    }

    // Check for unique constraint error
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'A heatmap type with this name already exists' });
    }

    res.status(500).json({ error: 'Failed to update heatmap type' });
  }
});

// Delete a heatmap type
router.delete('/heatmap/types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const typeId = parseInt(id, 10);
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // First, get count of datapoints that will be orphaned (have only this type)
    const orphanedDatapoints = await prisma.heatmapDatapoint.findMany({
      where: {
        types: {
          some: {
            typeId: typeId
          }
        },
        AND: {
          types: {
            every: {
              typeId: typeId
            }
          }
        }
      },
      select: {
        id: true
      }
    });

    // Get list of datapoint IDs that would be orphaned
    const orphanedDatapointIds = orphanedDatapoints.map(dp => dp.id);

    // Start a transaction to ensure everything gets deleted or nothing does
    await prisma.$transaction(async (tx) => {
      // First, delete the orphaned datapoints (those with only this type)
      if (orphanedDatapointIds.length > 0) {
        await tx.heatmapDatapoint.deleteMany({
          where: {
            id: {
              in: orphanedDatapointIds
            }
          }
        });
      }

      // Then delete the type (this will cascade delete the junction records)
      await tx.heatmapType.delete({
        where: { id: typeId }
      });
    });

    res.status(200).json({
      message: 'Type deleted successfully',
      deletedDatapoints: orphanedDatapointIds.length
    });
  } catch (error) {
    console.error('Error deleting heatmap type:', error);

    // Check for Prisma not found error
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Heatmap type not found for deletion' });
    }

    res.status(500).json({ error: 'Failed to delete heatmap type' });
  }
});

// Get all heatmap datapoints
router.get('/heatmap/datapoints', async (req, res) => {
  try {
    const { typeId, visible, orphaned } = req.query;
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    let where = {};

    // Handle orphaned filter - datapoints with no types
    if (orphaned === 'true') {
      // Find datapoints that have 0 types
      where = {
        types: {
          none: {}
        }
      };
    } else {
      // Add type filters if not looking for orphaned
      if (typeId) {
        // Handle multiple type IDs separated by commas
        if (typeId.includes(',')) {
          const typeIds = typeId.split(',').map(id => parseInt(id, 10));
          where.types = {
            some: {
              typeId: {
                in: typeIds
              }
            }
          };
        } else {
          where.types = {
            some: {
              typeId: parseInt(typeId, 10)
            }
          };
        }
      }
    }

    // Add visibility filter if provided
    if (visible !== undefined) {
      where.visible = visible === 'true';
    }

    const datapoints = await prisma.heatmapDatapoint.findMany({
      where,
      include: {
        types: {
          include: {
            type: true
          }
        }
      },
      orderBy: {
        timestamp: 'desc'
      }
    });

    // Transform the output to a more convenient format
    const transformedDatapoints = datapoints.map(dp => ({
      id: dp.id,
      lat: dp.lat,
      intensity: dp.intensity,
      weight: dp.weight,
      radius: dp.radius,
      timestamp: dp.timestamp,
      lastModified: dp.lastModified,
      visible: dp.visible,
      orphaned: dp.types.length === 0,
      types: dp.types.map(t => ({
        id: t.type.id,
        name: t.type.name,
        intensity: t.type.intensity,
        colorBindings: t.type.colorBindings
      }))
    }));

    res.json(transformedDatapoints);
  } catch (error) {
    console.error('Error fetching heatmap datapoints:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap datapoints' });
  }
});

// Get a summary of orphaned datapoints count
router.get('/heatmap/stats', async (req, res) => {
  try {
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // Count total datapoints
    const totalDatapoints = await prisma.heatmapDatapoint.count();

    // Count orphaned datapoints (those without any types)
    const orphanedDatapoints = await prisma.heatmapDatapoint.count({
      where: {
        types: {
          none: {}
        }
      }
    });

    // Count datapoints by type
    const types = await prisma.heatmapType.findMany({
      include: {
        _count: {
          select: {
            datapoints: true
          }
        }
      }
    });

    const typeStats = types.map(type => ({
      id: type.id,
      name: type.name,
      datapointCount: type._count.datapoints
    }));

    res.json({
      total: totalDatapoints,
      orphanedCount: orphanedDatapoints,
      types: typeStats
    });
  } catch (error) {
    console.error('Error fetching heatmap stats:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap statistics' });
  }
});

// Create a new heatmap datapoint
router.post('/heatmap/datapoints', async (req, res) => {
  try {
    const { lat, intensity, weight, radius, visible, typeIds } = req.body;
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // Validate required fields
    if (!lat || !weight || !Array.isArray(typeIds) || typeIds.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields. Required: lat, weight, and at least one typeId'
      });
    }

    // Create datapoint with type connections
    const newDatapoint = await prisma.heatmapDatapoint.create({
      data: {
        lat,
        intensity: intensity ?? 0.75,
        weight,
        radius: radius ?? 25,
        visible: visible ?? true,
        types: {
          create: typeIds.map(typeId => ({
            type: {
              connect: { id: parseInt(typeId, 10) }
            }
          }))
        }
      },
      include: {
        types: {
          include: {
            type: true
          }
        }
      }
    });

    // Transform to a more convenient format
    const transformedDatapoint = {
      id: newDatapoint.id,
      lat: newDatapoint.lat,
      intensity: newDatapoint.intensity,
      weight: newDatapoint.weight,
      radius: newDatapoint.radius,
      timestamp: newDatapoint.timestamp,
      lastModified: newDatapoint.lastModified,
      visible: newDatapoint.visible,
      types: newDatapoint.types.map(t => ({
        id: t.type.id,
        name: t.type.name,
        intensity: t.type.intensity,
        colorBindings: t.type.colorBindings
      }))
    };

    res.status(201).json(transformedDatapoint);
  } catch (error) {
    console.error('Error creating heatmap datapoint:', error);
    res.status(500).json({ error: 'Failed to create heatmap datapoint' });
  }
});

// Update a heatmap datapoint
router.put('/heatmap/datapoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, intensity, weight, radius, visible, typeIds } = req.body;
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    const datapointId = parseInt(id, 10);

    // Start a transaction to handle updating the many-to-many relationship
    const updatedDatapoint = await prisma.$transaction(async (tx) => {
      // Delete existing relationships if typeIds is provided
      if (typeIds && Array.isArray(typeIds)) {
        await tx.heatmapDatapointType.deleteMany({
          where: { datapointId }
        });
      }

      // Update the datapoint
      const datapoint = await tx.heatmapDatapoint.update({
        where: { id: datapointId },
        data: {
          ...(lat !== undefined && { lat }),
          ...(intensity !== undefined && { intensity }),
          ...(weight !== undefined && { weight }),
          ...(radius !== undefined && { radius }),
          ...(visible !== undefined && { visible }),
          // Create new relationships if typeIds is provided
          ...(typeIds && Array.isArray(typeIds) && {
            types: {
              create: typeIds.map(typeId => ({
                type: {
                  connect: { id: parseInt(typeId, 10) }
                }
              }))
            }
          })
        },
        include: {
          types: {
            include: {
              type: true
            }
          }
        }
      });

      return datapoint;
    });

    // Transform to a more convenient format
    const transformedDatapoint = {
      id: updatedDatapoint.id,
      lat: updatedDatapoint.lat,
      intensity: updatedDatapoint.intensity,
      weight: updatedDatapoint.weight,
      radius: updatedDatapoint.radius,
      timestamp: updatedDatapoint.timestamp,
      lastModified: updatedDatapoint.lastModified,
      visible: updatedDatapoint.visible,
      types: updatedDatapoint.types.map(t => ({
        id: t.type.id,
        name: t.type.name,
        intensity: t.type.intensity,
        colorBindings: t.type.colorBindings
      }))
    };

    res.json(transformedDatapoint);
  } catch (error) {
    console.error('Error updating heatmap datapoint:', error);

    // Check for Prisma not found error
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Heatmap datapoint not found for update' });
    }

    res.status(500).json({ error: 'Failed to update heatmap datapoint' });
  }
});

// Delete a heatmap datapoint
router.delete('/heatmap/datapoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    await prisma.heatmapDatapoint.delete({
      where: { id: parseInt(id, 10) }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting heatmap datapoint:', error);

    // Check for Prisma not found error
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Heatmap datapoint not found for deletion' });
    }

    res.status(500).json({ error: 'Failed to delete heatmap datapoint' });
  }
});

// Add this endpoint after the existing heatmap endpoints

// Bulk update datapoints
router.post('/heatmap/datapoints/bulk', async (req, res) => {
  try {
    const {
      ids,
      typeIds,
      typeAction = 'replace',
      weight,
      intensity,
      radius,
      visible
    } = req.body;

    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // Validate required fields
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No datapoint IDs provided' });
    }

    // Process each datapoint in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const updateResults = [];

      for (const id of ids) {
        try {
          const datapointId = parseInt(id, 10);

          // Handle type updates if specified
          if (typeIds && typeAction) {
            // Get current datapoint to determine existing types
            const currentDatapoint = await tx.heatmapDatapoint.findUnique({
              where: { id: datapointId },
              include: {
                types: true
              }
            });

            if (!currentDatapoint) {
              updateResults.push({
                id,
                success: false,
                message: 'Datapoint not found'
              });
              continue;
            }

            // Determine which types to apply based on the action
            let finalTypeIds = [];

            if (typeAction === 'replace') {
              // Replace all types with the new ones
              finalTypeIds = typeIds;
            }
            else if (typeAction === 'add') {
              // Get current type IDs
              const currentTypeIds = currentDatapoint.types.map(t => t.typeId);
              // Combine and deduplicate
              finalTypeIds = [...new Set([...currentTypeIds, ...typeIds])];
            }
            else if (typeAction === 'remove') {
              // Get current type IDs
              const currentTypeIds = currentDatapoint.types.map(t => t.typeId);
              // Filter out the ones to remove
              finalTypeIds = currentTypeIds.filter(id => !typeIds.includes(id));
            }

            // Delete existing type relationships
            await tx.heatmapDatapointType.deleteMany({
              where: { datapointId }
            });

            // Create new type relationships
            if (finalTypeIds.length > 0) {
              await tx.heatmapDatapoint.update({
                where: { id: datapointId },
                data: {
                  types: {
                    create: finalTypeIds.map(typeId => ({
                      type: {
                        connect: { id: parseInt(typeId, 10) }
                      }
                    }))
                  }
                }
              });
            }
          }

          // Handle other property updates
          const updateData = {};
          if (weight !== undefined) updateData.weight = parseInt(weight, 10);
          if (intensity !== undefined) updateData.intensity = parseFloat(intensity);
          if (radius !== undefined) updateData.radius = parseInt(radius, 10);
          if (visible !== undefined) updateData.visible = visible;

          if (Object.keys(updateData).length > 0) {
            await tx.heatmapDatapoint.update({
              where: { id: datapointId },
              data: updateData
            });
          }

          updateResults.push({
            id,
            success: true
          });
        } catch (error) {
          console.error(`Error updating datapoint ${id}:`, error);
          updateResults.push({
            id,
            success: false,
            message: error.message
          });
        }
      }

      return updateResults;
    });

    // Summarize results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      totalCount: ids.length,
      successCount,
      failureCount,
      results
    });
  } catch (error) {
    console.error('Error performing bulk update:', error);
    res.status(500).json({ error: 'Failed to perform bulk update' });
  }
});

// Clean up orphaned datapoints
router.post('/heatmap/datapoints/cleanup', async (req, res) => {
  try {
    const { action, typeId } = req.body;
    const prisma = await db.getPrismaClient();

    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // Find orphaned datapoints (those with no types)
    const orphanedDatapoints = await prisma.heatmapDatapoint.findMany({
      where: {
        types: {
          none: {}
        }
      },
      select: {
        id: true
      }
    });

    const orphanedIds = orphanedDatapoints.map(dp => dp.id);

    if (orphanedIds.length === 0) {
      return res.json({
        message: 'No orphaned datapoints found',
        count: 0
      });
    }

    if (action === 'delete') {
      // Delete all orphaned datapoints
      await prisma.heatmapDatapoint.deleteMany({
        where: {
          id: {
            in: orphanedIds
          }
        }
      });

      return res.json({
        message: 'Orphaned datapoints deleted successfully',
        count: orphanedIds.length
      });
    }
    else if (action === 'assign' && typeId) {
      // Assign all orphaned datapoints to the specified type
      const typeIdInt = parseInt(typeId, 10);

      // Verify the type exists
      const typeExists = await prisma.heatmapType.findUnique({
        where: { id: typeIdInt }
      });

      if (!typeExists) {
        return res.status(404).json({ error: 'Specified type not found' });
      }

      // Assign to each orphaned datapoint
      for (const datapointId of orphanedIds) {
        await prisma.heatmapDatapointType.create({
          data: {
            datapoint: {
              connect: { id: datapointId }
            },
            type: {
              connect: { id: typeIdInt }
            }
          }
        });
      }

      return res.json({
        message: 'Orphaned datapoints assigned to type successfully',
        count: orphanedIds.length,
        typeId: typeIdInt,
        typeName: typeExists.name
      });
    }

    return res.status(400).json({ error: 'Invalid action specified' });
  } catch (error) {
    console.error('Error cleaning up orphaned datapoints:', error);
    res.status(500).json({ error: 'Failed to clean up orphaned datapoints' });
  }
});

export default router;
