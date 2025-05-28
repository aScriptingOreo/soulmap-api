const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const prisma = new PrismaClient();

/**
 * Heatmap API endpoints
 */

// Helper function to generate demo data
function generateDemoData(type, count = 1000) {
  const data = [];
  const width = 7680;
  const height = 6656;

  // Generate random hotspots
  const hotspots = [];
  const numHotspots = 5;

  for (let i = 0; i < numHotspots; i++) {
    hotspots.push([
      Math.floor(Math.random() * width),
      Math.floor(Math.random() * height)
    ]);
  }

  // Generate points around hotspots
  for (let i = 0; i < count; i++) {
    // Pick a random hotspot
    const hotspot = hotspots[Math.floor(Math.random() * hotspots.length)];

    // Create a point near the hotspot with random deviation
    const stdDev = 500; // Standard deviation (spread)
    const x = Math.max(0, Math.min(width, hotspot[0] + (Math.random() - 0.5) * stdDev * 2));
    const y = Math.max(0, Math.min(height, hotspot[1] + (Math.random() - 0.5) * stdDev * 2));

    // Random intensity between 0.1 and 1
    const intensity = 0.1 + Math.random() * 0.9;

    data.push([x, y, intensity]);
  }

  return data;
}

/**
 * @route GET /api/heatmap
 * @description Get available heatmap data types
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    // In a real implementation, we would query the database for available types
    const types = ['aggregated', 'deaths', 'rare', 'resources', 'enemies', 'player'];

    res.json({
      types,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching heatmap types:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap types' });
  }
});

/**
 * @route GET /api/heatmap/:type
 * @description Get heatmap data for a specific type
 * @access Public
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;

    // In a real implementation, we would query the database
    let data, statistics;

    // For now, generate demo data
    const pointCount = type === 'aggregated' ? 2000 : 1000;
    data = generateDemoData(type, pointCount);

    // Generate demo statistics
    statistics = {
      count: data.length,
      avgIntensity: 0.5,
      maxIntensity: 1.0,
      minIntensity: 0.1
    };

    // Return the data with metadata
    res.json({
      data,
      type,
      timestamp: new Date().toISOString(),
      types: ['aggregated', 'deaths', 'rare', 'resources', 'enemies', 'player'],
      statistics
    });
  } catch (error) {
    console.error(`Error fetching ${req.params.type} heatmap data:`, error);
    res.status(500).json({ error: `Failed to fetch ${req.params.type} heatmap data` });
  }
});

/**
 * Get all heatmap datapoints with their associated types
 */
router.get('/datapoints', async (req, res) => {
  try {
    const datapoints = await prisma.heatmapDatapoint.findMany({
      include: {
        types: {
          include: {
            type: true
          }
        }
      }
    });

    // Transform the data to make it more convenient for the client
    const transformedDatapoints = datapoints.map(datapoint => ({
      id: datapoint.id,
      lat: datapoint.lat, // This is already in [x, y] format
      intensity: datapoint.intensity,
      weight: datapoint.weight,
      radius: datapoint.radius,
      visible: datapoint.visible,
      timestamp: datapoint.timestamp,
      // Transform the types array to be more usable
      types: datapoint.types.map(t => ({
        id: t.type.id,
        name: t.type.name,
        intensity: t.type.intensity
      }))
    }));

    res.json(transformedDatapoints);
  } catch (error) {
    console.error('Error fetching heatmap datapoints:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap datapoints' });
  }
});

/**
 * Get all heatmap types with their color bindings
 */
router.get('/types', async (req, res) => {
  try {
    const types = await prisma.heatmapType.findMany();

    res.json(types);
  } catch (error) {
    console.error('Error fetching heatmap types:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap types' });
  }
});

/**
 * Create a new heatmap datapoint
 */
router.post('/datapoints', async (req, res) => {
  try {
    const { lat, intensity, weight, radius, typeIds } = req.body;

    // Validate required fields
    if (!lat || lat.length !== 2 || !Array.isArray(lat)) {
      return res.status(400).json({ error: 'Invalid coordinates format. Must be [x, y] array.' });
    }

    if (!weight || isNaN(parseInt(weight))) {
      return res.status(400).json({ error: 'Weight is required and must be a number.' });
    }

    // Create the datapoint
    const datapoint = await prisma.heatmapDatapoint.create({
      data: {
        lat, // Store as JSON
        intensity: intensity || 0.75,
        weight: parseInt(weight),
        radius: radius || 25,
        // Connect to any specified types
        ...(typeIds && typeIds.length > 0 ? {
          types: {
            create: typeIds.map(typeId => ({
              type: { connect: { id: parseInt(typeId) } }
            }))
          }
        } : {})
      },
      include: {
        types: {
          include: {
            type: true
          }
        }
      }
    });

    res.status(201).json(datapoint);
  } catch (error) {
    console.error('Error creating heatmap datapoint:', error);
    res.status(500).json({ error: 'Failed to create heatmap datapoint' });
  }
});

/**
 * Create a new heatmap type
 */
router.post('/types', async (req, res) => {
  try {
    const { name, intensity, colorBindings } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Name is required for heatmap type.' });
    }

    // Validate colorBindings if provided
    if (colorBindings) {
      try {
        // Attempt to parse if it's a string
        const bindingsObj = typeof colorBindings === 'string'
          ? JSON.parse(colorBindings)
          : colorBindings;

        // Check that it's a valid object with number keys and string values
        Object.entries(bindingsObj).forEach(([key, value]) => {
          if (isNaN(parseFloat(key))) {
            throw new Error(`Invalid weight key: ${key}`);
          }
          if (typeof value !== 'string') {
            throw new Error(`Invalid color value for weight ${key}`);
          }
        });
      } catch (error) {
        return res.status(400).json({ error: `Invalid colorBindings format: ${error.message}` });
      }
    }

    // Create the type
    const type = await prisma.heatmapType.create({
      data: {
        name,
        intensity: intensity ? parseFloat(intensity) : null,
        colorBindings: colorBindings || null
      }
    });

    res.status(201).json(type);
  } catch (error) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A heatmap type with this name already exists.' });
    }

    console.error('Error creating heatmap type:', error);
    res.status(500).json({ error: 'Failed to create heatmap type' });
  }
});

/**
 * Update a heatmap datapoint
 */
router.put('/datapoints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, intensity, weight, radius, visible, typeIds } = req.body;

    // Build the update data object
    const updateData = {};

    if (lat && Array.isArray(lat) && lat.length === 2) {
      updateData.lat = lat;
    }

    if (intensity !== undefined) {
      updateData.intensity = parseFloat(intensity);
    }

    if (weight !== undefined) {
      updateData.weight = parseInt(weight);
    }

    if (radius !== undefined) {
      updateData.radius = parseInt(radius);
    }

    if (visible !== undefined) {
      updateData.visible = Boolean(visible);
    }

    // Update the datapoint
    const datapoint = await prisma.heatmapDatapoint.update({
      where: { id: parseInt(id) },
      data: {
        ...updateData,
        // If typeIds is provided, update the type connections
        ...(typeIds ? {
          types: {
            // Delete all existing connections first
            deleteMany: {},
            // Then create new connections
            create: typeIds.map(typeId => ({
              type: { connect: { id: parseInt(typeId) } }
            }))
          }
        } : {})
      },
      include: {
        types: {
          include: {
            type: true
          }
        }
      }
    });

    res.json(datapoint);
  } catch (error) {
    console.error('Error updating heatmap datapoint:', error);
    res.status(500).json({ error: 'Failed to update heatmap datapoint' });
  }
});

/**
 * Update a heatmap type
 */
router.put('/types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, intensity, colorBindings } = req.body;

    // Build the update data object
    const updateData = {};

    if (name) {
      updateData.name = name;
    }

    if (intensity !== undefined) {
      updateData.intensity = intensity !== null ? parseFloat(intensity) : null;
    }

    if (colorBindings !== undefined) {
      // Validate colorBindings if provided
      if (colorBindings) {
        try {
          // Attempt to parse if it's a string
          const bindingsObj = typeof colorBindings === 'string'
            ? JSON.parse(colorBindings)
            : colorBindings;

          // Check that it's a valid object with number keys and string values
          Object.entries(bindingsObj).forEach(([key, value]) => {
            if (isNaN(parseFloat(key))) {
              throw new Error(`Invalid weight key: ${key}`);
            }
            if (typeof value !== 'string') {
              throw new Error(`Invalid color value for weight ${key}`);
            }
          });

          // Store as JSON
          updateData.colorBindings = typeof colorBindings === 'string'
            ? colorBindings
            : JSON.stringify(colorBindings);
        } catch (error) {
          return res.status(400).json({ error: `Invalid colorBindings format: ${error.message}` });
        }
      } else {
        updateData.colorBindings = null;
      }
    }

    // Update the type
    const type = await prisma.heatmapType.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json(type);
  } catch (error) {
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A heatmap type with this name already exists.' });
    }

    console.error('Error updating heatmap type:', error);
    res.status(500).json({ error: 'Failed to update heatmap type' });
  }
});

/**
 * Delete a heatmap datapoint
 */
router.delete('/datapoints/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.heatmapDatapoint.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting heatmap datapoint:', error);
    res.status(500).json({ error: 'Failed to delete heatmap datapoint' });
  }
});

/**
 * Delete a heatmap type
 */
router.delete('/types/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.heatmapType.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting heatmap type:', error);
    res.status(500).json({ error: 'Failed to delete heatmap type' });
  }
});

module.exports = router;
