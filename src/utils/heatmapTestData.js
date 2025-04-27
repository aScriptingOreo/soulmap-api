/**
 * Utility to generate test data for the heatmap feature
 */

// Sample heatmap types
const sampleTypes = [
  {
    name: "Anomalies",
    intensity: 0.8,
    colorBindings: {
      "0.4": "#0000ff", // Blue
      "0.6": "#00ffff", // Cyan
      "0.8": "#00ff00", // Green
      "1.0": "#ff0000"  // Red
    }
  },
  {
    name: "Monster Density",
    intensity: 0.7,
    colorBindings: {
      "0.4": "#006400", // Dark Green
      "0.6": "#9acd32", // Yellow Green
      "0.8": "#daa520", // Golden Rod
      "1.0": "#ff4500"  // Orange Red
    }
  },
  {
    name: "Player Deaths",
    intensity: 0.6,
    colorBindings: {
      "0.4": "#4b0082", // Indigo
      "0.6": "#800080", // Purple
      "0.8": "#ff00ff", // Magenta
      "1.0": "#ff0000"  // Red
    }
  },
  {
    name: "Resource Nodes",
    intensity: 0.75,
    colorBindings: {
      "0.4": "#ffd700", // Gold
      "0.6": "#ff8c00", // Dark Orange
      "0.8": "#ff4500", // Orange Red
      "1.0": "#8b0000"  // Dark Red
    }
  }
];

// Generate semi-random test data points around specific locations
function generateTestDatapoints() {
  const datapoints = [];
  
  // Base locations to generate clusters around
  const baseLocations = [
    { x: 3500, y: 3500 }, // Center of map
    { x: 2000, y: 2000 }, // Upper left quadrant
    { x: 5000, y: 2000 }, // Upper right quadrant
    { x: 2000, y: 5000 }, // Lower left quadrant
    { x: 5000, y: 5000 }  // Lower right quadrant
  ];
  
  // For each base location, create a cluster of points
  baseLocations.forEach(base => {
    // Random number of points for this cluster (10-30)
    const pointCount = 10 + Math.floor(Math.random() * 20);
    
    for (let i = 0; i < pointCount; i++) {
      // Random offset from the base (within 500 units)
      const offsetX = (Math.random() - 0.5) * 1000;
      const offsetY = (Math.random() - 0.5) * 1000;
      
      // Create datapoint
      datapoints.push({
        lat: [base.x + offsetX, base.y + offsetY],
        intensity: 0.3 + Math.random() * 0.7, // Random intensity between 0.3 and 1.0
        weight: 50 + Math.floor(Math.random() * 50), // Random weight between 50 and 100
        radius: 20 + Math.floor(Math.random() * 20), // Random radius between 20 and 40
        visible: true,
        // We'll assign type IDs after creating the types
        typeIds: []
      });
    }
  });
  
  // Create some scattered individual points
  for (let i = 0; i < 50; i++) {
    datapoints.push({
      lat: [1000 + Math.random() * 6000, 1000 + Math.random() * 6000],
      intensity: 0.3 + Math.random() * 0.7,
      weight: 40 + Math.floor(Math.random() * 60),
      radius: 15 + Math.floor(Math.random() * 25),
      visible: true,
      typeIds: []
    });
  }
  
  return datapoints;
}

/**
 * Seed the database with test heatmap data if tables are empty
 */
export async function seedHeatmapTestData(prisma) {
  try {
    console.log("Checking if heatmap test data is needed...");
    
    // First check if tables exist by trying a safe operation
    let tablesExist = true;
    try {
      // Try to count types - this will fail if the table doesn't exist
      await prisma.heatmapType.count();
    } catch (error) {
      if (error.code === 'P2021') { 
        // P2021 is the Prisma error code for "table does not exist"
        tablesExist = false;
        console.log("Heatmap tables don't exist yet, will be created during migration");
        return { 
          success: false, 
          message: "Heatmap tables don't exist, run migrations first",
          needsMigration: true 
        };
      } else {
        // Some other error occurred
        throw error;
      }
    }
    
    // If we got here, the tables exist
    // Proceed with checking if they have data
    
    // Check if types table is empty
    const typeCount = await prisma.heatmapType.count();
    const datapointCount = await prisma.heatmapDatapoint.count();
    
    if (typeCount > 0 || datapointCount > 0) {
      console.log("Heatmap data already exists, skipping test data creation");
      return { success: false, message: "Heatmap tables already have data" };
    }
    
    console.log("Creating heatmap test data...");
    
    // Create heatmap types
    const createdTypes = [];
    for (const type of sampleTypes) {
      const createdType = await prisma.heatmapType.create({
        data: type
      });
      createdTypes.push(createdType);
    }
    
    console.log(`Created ${createdTypes.length} heatmap types`);
    
    // Generate test datapoints
    const datapoints = generateTestDatapoints();
    
    // Assign types to datapoints (each point gets 1-3 random types)
    datapoints.forEach(point => {
      // Decide how many types this point will have (1-3)
      const typeCount = 1 + Math.floor(Math.random() * 3);
      
      // Randomly select types
      const typeIds = new Set();
      while (typeIds.size < typeCount && typeIds.size < createdTypes.length) {
        const randomIndex = Math.floor(Math.random() * createdTypes.length);
        typeIds.add(createdTypes[randomIndex].id);
      }
      
      point.typeIds = [...typeIds];
    });
    
    // Create datapoints in database
    for (const datapoint of datapoints) {
      const { typeIds, ...datapointData } = datapoint;
      
      // Format lat field as required by the API
      // Convert from array to object format
      const formattedLat = { 
        lat: datapointData.lat[1], 
        lng: datapointData.lat[0] 
      };
      
      await prisma.heatmapDatapoint.create({
        data: {
          ...datapointData,
          lat: formattedLat,
          types: {
            create: typeIds.map(typeId => ({
              type: {
                connect: { id: typeId }
              }
            }))
          }
        }
      });
    }
    
    console.log(`Created ${datapoints.length} heatmap datapoints`);
    
    return {
      success: true,
      message: `Created ${createdTypes.length} heatmap types and ${datapoints.length} datapoints`
    };
  } catch (error) {
    console.error("Error creating heatmap test data:", error);
    return { 
      success: false, 
      message: "Error creating test data", 
      error: error.message 
    };
  }
}

export default {
  seedHeatmapTestData
};
