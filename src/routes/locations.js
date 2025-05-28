import express from 'express';
import db from '#db';  // Use #db instead of relative import

const router = express.Router();

console.log('Locations router file loaded.');

// Get all locations - Fixed to use Prisma directly
router.get('/', async (req, res) => {
  try {
    // Get Prisma client from db helper
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }

    // Use Prisma to get all locations
    const locations = await prisma.location.findMany();
    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Get database hash
router.get('/hash', async (req, res) => {
  try {
    // Implement direct hash generation if db.generateDatabaseHash doesn't exist
    const prisma = await db.getPrismaClient();
    if (!prisma) {
      return res.status(500).json({ error: 'Failed to connect to database' });
    }
    
    // Use an aggregate to generate a timestamp hash
    const result = await prisma.location.aggregate({
      _max: {
        lastModified: true
      }
    });
    
    const timestamp = result._max.lastModified?.getTime() || Date.now();
    const hash = `loc-${timestamp}`;
    
    res.json({ hash });
  } catch (error) {
    console.error('Error generating database hash:', error);
    res.status(500).json({ error: 'Failed to generate hash', hash: `error-server-${Date.now()}` });
  }
});

// Get individual location hashes
router.get('/hashes', async (req, res) => {
  try {
    const locations = await db.getAllLocations();
    const hashes = {};
    const DISABLED_MARKER = '![DISABLED]';

    locations.forEach(location => {
      // Don't include disabled locations in the hashes
      if (!location.type?.includes(DISABLED_MARKER)) {
        hashes[location.name] = location.lastModified?.getTime().toString() || Date.now().toString();
      }
    });

    res.json({ hashes });
  } catch (error) {
    console.error('Error generating marker hashes:', error);
    res.status(500).json({ error: 'Failed to generate marker hashes' });
  }
});

// NEW: Get all categories and subcategories
router.get('/categories', async (req, res) => {
  try {
    const locations = await db.getAllLocations();
    const categoryTree = buildCategoryTree(locations);
    res.json(categoryTree);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// FIX: Replace the problematic wildcard route with a simpler approach
// NEW: Get locations by category path - using separate path segments
router.get('/category/:path', async (req, res) => {
  try {
    // Get the category path from the request
    let categoryPath = req.params.path || '';

    // If we have additional path segments in the URL, they'll be in req.params[0]
    // Express puts the rest of the path in req.params[0] when using * in routes
    if (req.params[0]) {
      categoryPath += '/' + req.params[0];
    }

    // Ensure the path starts with a slash
    if (!categoryPath.startsWith('/')) {
      categoryPath = '/' + categoryPath;
    }

    console.log(`Finding locations for category path: ${categoryPath}`);

    // Use a query parameter to handle the actual search
    const locations = await db.getLocationsByCategory(categoryPath);
    res.json(locations);
  } catch (error) {
    console.error('Error fetching locations by category:', error);
    res.status(500).json({ error: 'Failed to fetch locations by category' });
  }
});

// Optimize the category route to support pagination for better performance
router.get('/category', async (req, res) => {
  try {
    // Get the category path from the query parameter
    let categoryPath = req.query.path || '/';

    // Optional pagination parameters
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 200; // Reasonable default

    // Ensure the path starts with a slash
    if (!categoryPath.startsWith('/')) {
      categoryPath = '/' + categoryPath;
    }

    console.log(`Finding locations for category path (query): ${categoryPath}, page: ${page}, limit: ${limit}`);

    const locations = await db.getLocationsByCategory(categoryPath, page, limit);

    // Get total count separately if it's the first page
    let totalCount = null;
    if (page === 0) {
      totalCount = await db.countLocationsByCategory(categoryPath);

      // Include the count in response headers
      res.setHeader('X-Total-Count', totalCount.toString());
    }

    // Send the response with optional metadata
    if (totalCount !== null) {
      res.json({
        items: locations,
        totalCount,
        page,
        limit
      });
    } else {
      res.json(locations);
    }
  } catch (error) {
    console.error('Error fetching locations by category:', error);
    res.status(500).json({ error: 'Failed to fetch locations by category' });
  }
});

// Get location by ID - use regular parameter to avoid conflict with other routes
router.get('/:id', async (req, res) => {
  try {
    const location = await db.getLocationById(req.params.id);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

// ENHANCED: Get category defaults with improved documentation
router.get('/category-defaults', async (req, res) => {
  try {
    // Fetch category defaults from database
    const defaults = await db.getCategoryDefaults();

    // Log the defaults being sent
    console.log(`Sending ${defaults.length} category defaults`);

    // Add a useful note for API consumers
    res.json({
      results: defaults,
      note: "Categories marked with 'hidden: true' should be hidden by default on first load"
    });
  } catch (error) {
    console.error('Error fetching category defaults:', error);
    res.status(500).json({
      error: 'Failed to fetch category defaults',
      message: error.message
    });
  }
});

// ENHANCED: Save category default (admin only) with better validation
router.post('/category-defaults', async (req, res) => {
  try {
    // TODO: Add authentication check for admin
    const categoryDefault = req.body;

    // Improved validation
    if (!categoryDefault.path) {
      return res.status(400).json({ error: 'Category path is required' });
    }

    // Ensure path is properly formatted
    if (!categoryDefault.path.startsWith('/')) {
      categoryDefault.path = '/' + categoryDefault.path;
    }

    // Validate hidden flag is a boolean
    if (categoryDefault.hidden !== undefined && typeof categoryDefault.hidden !== 'boolean') {
      return res.status(400).json({
        error: 'The hidden property must be a boolean'
      });
    }

    // Save the category default
    const result = await db.saveCategoryDefault(categoryDefault);

    // Log successful update
    console.log(`Category default saved: ${categoryDefault.path}, hidden: ${categoryDefault.hidden}`);

    res.json({
      success: true,
      result,
      message: `Category default for '${categoryDefault.path}' has been saved`
    });
  } catch (error) {
    console.error('Error saving category default:', error);
    res.status(500).json({
      error: 'Failed to save category default',
      message: error.message
    });
  }
});

// NEW: Delete category default (admin only) - using a fixed route structure to avoid path-to-regexp issues
router.delete('/category-defaults/:id', async (req, res) => {
  try {
    // TODO: Add authentication check for admin

    const id = req.params.id;
    const path = req.query.path; // Get path from query parameter

    if (!path) {
      return res.status(400).json({ error: 'Category path is required (as query parameter)' });
    }

    await db.deleteCategoryDefault(path);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category default:', error);
    res.status(500).json({ error: 'Failed to delete category default' });
  }
});

// Helper function to build category tree from locations
function buildCategoryTree(locations) {
  const tree = {
    name: 'root',
    path: '/',
    children: {},
    items: []
  };

  // Process each location
  locations.forEach(location => {
    // Skip disabled locations
    const DISABLED_MARKER = '![DISABLED]';
    if (location.type?.includes(DISABLED_MARKER)) {
      return;
    }

    // Ensure type starts with a slash
    let type = location.type;
    if (!type.startsWith('/')) {
      type = `/${type}`;
    }

    // Split the path into segments
    const segments = type.split('/').filter(Boolean);

    // If no segments, add to root
    if (segments.length === 0) {
      tree.items.push({
        id: location.id,
        name: location.name,
        type: location.type,
        coordinates: location.coordinates
      });
      return;
    }

    // Navigate through the tree based on path segments
    let currentNode = tree;
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Create node if it doesn't exist
      if (!currentNode.children[segment]) {
        currentNode.children[segment] = {
          name: segment,
          path: currentPath,
          children: {},
          items: []
        };
      }

      // Move to the next node
      currentNode = currentNode.children[segment];

      // If this is the last segment, add the location to this node
      if (index === segments.length - 1) {
        currentNode.items.push({
          id: location.id,
          name: location.name,
          type: location.type,
          coordinates: location.coordinates
        });
      }
    });
  });

  // Convert tree to array format for easier consumption
  return convertTreeToArray(tree);
}

// Helper function to convert tree to array format
function convertTreeToArray(node) {
  const result = {
    name: node.name,
    path: node.path,
    items: node.items,
    children: Object.values(node.children).map(child => convertTreeToArray(child))
  };

  return result;
}

export default router;
