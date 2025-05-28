import { Pool, PoolClient } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { EventEmitter } from 'events';

// Create event emitter for database notifications
const dbEvents = new EventEmitter();

// Initialize connection pool using DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 5000, // Return error after 5 seconds if connection could not be established
});

// Log pool creation
console.log('PostgreSQL connection pool created');

// Handle pool errors
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// For database migration and schema management only
let prismaClient: PrismaClient | null = null;

/**
 * Get a database client from the pool
 */
export async function getClient(): Promise<PoolClient> {
  try {
    return await pool.connect();
  } catch (error) {
    console.error('Error getting database client from pool:', error);
    throw new Error('Failed to connect to database');
  }
}

/**
 * Execute a query with parameters and return the results
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export async function query(text: string, params: any[] = []): Promise<any> {
  const client = await getClient();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a single query and return the first result
 * @param text SQL query text
 * @param params Query parameters
 * @returns First result row or null
 */
export async function queryOne(text: string, params: any[] = []): Promise<any> {
  const rows = await query(text, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get Prisma client (for migration and schema management only)
 * NOTE: This should only be used for database migrations and setup
 * @returns PrismaClient instance
 */
export async function getPrismaClient(): Promise<PrismaClient | null> {
  try {
    if (!prismaClient) {
      prismaClient = new PrismaClient({
        errorFormat: 'pretty',
      });
      await prismaClient.$connect();
    }
    return prismaClient;
  } catch (error) {
    console.error('Failed to initialize Prisma client:', error);
    return null;
  }
}

/**
 * Close all database connections
 */
export async function closeConnections(): Promise<void> {
  try {
    // Close Prisma client if it exists
    if (prismaClient) {
      await prismaClient.$disconnect();
      prismaClient = null;
    }
    
    // End pool
    await pool.end();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}

/**
 * Set up a database listener for table changes
 * @param channel Channel name to listen on
 * @param callback Function to call when notification received
 */
export async function setupListener(channel: string, callback: (payload: string) => void): Promise<void> {
  try {
    const client = await pool.connect();
    
    // Set up notification listener
    client.on('notification', (msg) => {
      if (msg.channel === channel && msg.payload) {
        callback(msg.payload);
      }
    });
    
    // Listen for notifications on the specified channel
    await client.query(`LISTEN ${channel}`);
    
    console.log(`Database listener set up on channel: ${channel}`);
    
    // Don't release this client as it needs to stay connected for notifications
    // Instead, handle connection errors and reconnect if needed
    client.on('error', async (err) => {
      console.error('Error in database notification client:', err);
      client.release();
      
      // Try to reconnect after a short delay
      setTimeout(() => {
        setupListener(channel, callback).catch(error => {
          console.error('Failed to reconnect notification client:', error);
        });
      }, 5000);
    });
    
    return;
  } catch (error) {
    console.error('Error setting up database listener:', error);
    throw error;
  }
}

/**
 * Get locations by category path
 * @param categoryPath - The category path to filter by (e.g., '/Fable/Quests')
 * @returns Array of locations in the category
 */
export async function getLocationsByCategory(categoryPath: string): Promise<any[]> {
  try {
    // Normalize the category path to ensure it has a leading slash
    const normalizedPath = categoryPath.startsWith('/') ? categoryPath : `/${categoryPath}`;
    
    // Find locations where:
    // 1. Type exactly matches the category path, OR
    // 2. Type starts with the category path followed by a slash (subcategories)
    const result = await query(
      `SELECT * FROM "Location" WHERE type = $1 OR type LIKE $2`,
      [normalizedPath, `${normalizedPath}/%`]
    );
    
    return result;
  } catch (error) {
    console.error('Error getting locations by category:', error);
    throw error;
  }
}

/**
 * Get category defaults
 * @returns Array of category defaults
 */
export async function getCategoryDefaults(): Promise<any[]> {
  try {
    // Check if table exists first to avoid errors
    const tableExists = await queryOne(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'CategoryDefaults'
      )`
    );
    
    if (!tableExists || !tableExists.exists) {
      console.log('CategoryDefaults table does not exist, returning empty array');
      return [];
    }
    
    // Get all category defaults
    return await query(
      `SELECT * FROM "CategoryDefaults" ORDER BY "sortOrder" ASC`
    );
  } catch (error) {
    console.error('Error getting category defaults:', error);
    return []; // Return empty array on error to prevent UI issues
  }
}

/**
 * Save or update a category default
 * @param categoryDefault - The category default to save/update
 * @returns The saved category default
 */
export async function saveCategoryDefault(categoryDefault: any): Promise<any> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Normalize path to ensure it starts with a slash
    if (categoryDefault.path && !categoryDefault.path.startsWith('/')) {
      categoryDefault.path = `/${categoryDefault.path}`;
    }
    
    // Check if CategoryDefaults table exists
    const tableExists = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'CategoryDefaults'
      )`
    );
    
    if (!tableExists.rows[0].exists) {
      // Create the table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS "CategoryDefaults" (
          "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
          "path" TEXT UNIQUE NOT NULL,
          "visible" BOOLEAN NOT NULL DEFAULT true,
          "expanded" BOOLEAN NOT NULL DEFAULT true,
          "displayName" TEXT,
          "iconPath" TEXT,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Created CategoryDefaults table');
    }
    
    // Check if the record already exists
    const existingRecord = await client.query(
      `SELECT * FROM "CategoryDefaults" WHERE path = $1`,
      [categoryDefault.path]
    );
    
    let result;
    
    if (existingRecord.rows.length > 0) {
      // Update existing record
      result = await client.query(
        `UPDATE "CategoryDefaults" SET
          "visible" = $2,
          "expanded" = $3,
          "displayName" = $4,
          "iconPath" = $5,
          "sortOrder" = $6,
          "updatedAt" = CURRENT_TIMESTAMP
          WHERE path = $1
          RETURNING *`,
        [
          categoryDefault.path,
          categoryDefault.visible !== undefined ? categoryDefault.visible : true,
          categoryDefault.expanded !== undefined ? categoryDefault.expanded : true,
          categoryDefault.displayName,
          categoryDefault.iconPath,
          categoryDefault.sortOrder !== undefined ? categoryDefault.sortOrder : 0
        ]
      );
    } else {
      // Insert new record
      result = await client.query(
        `INSERT INTO "CategoryDefaults" (
          "path", "visible", "expanded", "displayName", "iconPath", "sortOrder"
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          categoryDefault.path,
          categoryDefault.visible !== undefined ? categoryDefault.visible : true,
          categoryDefault.expanded !== undefined ? categoryDefault.expanded : true,
          categoryDefault.displayName,
          categoryDefault.iconPath,
          categoryDefault.sortOrder !== undefined ? categoryDefault.sortOrder : 0
        ]
      );
    }
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving category default:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a category default
 * @param path - The path of the category default to delete
 */
export async function deleteCategoryDefault(path: string): Promise<void> {
  try {
    // Normalize path
    if (path && !path.startsWith('/')) {
      path = `/${path}`;
    }
    
    // Check if table exists first
    const tableExists = await queryOne(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'CategoryDefaults'
      )`
    );
    
    if (!tableExists || !tableExists.exists) {
      console.log('CategoryDefaults table does not exist, nothing to delete');
      return;
    }
    
    // Delete the category default
    await query(
      `DELETE FROM "CategoryDefaults" WHERE path = $1`,
      [path]
    );
  } catch (error) {
    console.error('Error deleting category default:', error);
    throw error;
  }
}

/**
 * Helper function to normalize coordinates format
 * @param coordinates - The coordinates to normalize
 * @returns Normalized coordinates
 */
export function normalizeCoordinates(coordinates: any): number[] | number[][] {
  // Log coordinates for debugging
  console.log('Normalizing coordinates:', JSON.stringify(coordinates));
  
  if (!coordinates) {
    return [0, 0]; // Default if no coordinates provided
  }
  
  // If it's already a valid format, return it
  if (Array.isArray(coordinates)) {
    // Single coordinate pair [x, y]
    if (coordinates.length === 2 &&
        typeof coordinates[0] === 'number' &&
        typeof coordinates[1] === 'number') {
      console.log('Already normalized - single coordinate pair:', coordinates);
      return coordinates;
    }
    
    // Multiple coordinates [[x,y], [x,y], ...]
    if (coordinates.length > 0 && Array.isArray(coordinates[0])) {
      console.log('Multiple coordinates array, returning as is');
      return coordinates;
    }
  }
  
  // Try to convert from string or other format
  try {
    if (typeof coordinates === 'string') {
      const parsed = JSON.parse(coordinates);
      return normalizeCoordinates(parsed); // Recursive call with parsed data
    }
  } catch (e) {
    console.error('Error parsing coordinates string:', e);
  }
  
  // Fallback default
  console.log('Using fallback default coordinates');
  return [0, 0];
}

/**
 * Save a location
 * @param locationData - The location data to save
 * @returns The saved location
 */
export async function saveLocation(locationData: any): Promise<any> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Clean and normalize the data
    const data = { ...locationData };
    
    // Normalize coordinates if present
    if (data.coordinates) {
      data.coordinates = normalizeCoordinates(data.coordinates);
    } else {
      data.coordinates = [0, 0]; // Default coordinates
    }
    
    // Convert to JSONB for PostgreSQL
    const coordinatesJson = JSON.stringify(data.coordinates);
    const mediaUrlJson = data.mediaUrl ? JSON.stringify(data.mediaUrl) : '[]';
    const exactCoordinatesJson = data.exactCoordinates ? JSON.stringify(data.exactCoordinates) : null;
    
    // Set defaults for missing fields
    const iconSize = data.iconSize ?? 1;
    const iconColor = data.iconColor ?? '#ffffff';
    const radius = data.radius ?? 0;
    const isCoordinateSearch = data.isCoordinateSearch ?? false;
    const noCluster = data.noCluster ?? false;
    
    // Create the location
    const result = await client.query(
      `INSERT INTO "Location" (
        "name", "description", "type", "coordinates", "icon", "iconSize",
        "iconColor", "radius", "lore", "spoilers", "isCoordinateSearch",
        "noCluster", "mediaUrl", "exactCoordinates", "submittedBy", "approvedBy"
      ) VALUES (
        $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $16
      ) RETURNING *`,
      [
        data.name,
        data.description || '',
        data.type,
        coordinatesJson,
        data.icon,
        iconSize,
        iconColor,
        radius,
        data.lore || '',
        data.spoilers || '',
        isCoordinateSearch,
        noCluster,
        mediaUrlJson,
        exactCoordinatesJson,
        data.submittedBy,
        data.approvedBy
      ]
    );
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving location:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update a location
 * @param id - The ID of the location to update
 * @param locationData - The location data to update
 * @returns The updated location
 */
export async function updateLocation(id: string, locationData: any): Promise<any> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Clone the data to avoid modifying the input
    const data = { ...locationData };
    
    // Normalize coordinates if present
    if (data.coordinates) {
      data.coordinates = normalizeCoordinates(data.coordinates);
    }
    
    // Build the update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [id]; // First param is always the ID
    let paramIndex = 2; // Start parameter index at 2 (after ID)
    
    // Handle each field that might be updated
    if (data.name !== undefined) {
      updates.push(`"name" = $${paramIndex++}`);
      values.push(data.name);
    }
    
    if (data.description !== undefined) {
      updates.push(`"description" = $${paramIndex++}`);
      values.push(data.description);
    }
    
    if (data.type !== undefined) {
      updates.push(`"type" = $${paramIndex++}`);
      values.push(data.type);
    }
    
    if (data.coordinates !== undefined) {
      updates.push(`"coordinates" = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(data.coordinates));
    }
    
    if (data.icon !== undefined) {
      updates.push(`"icon" = $${paramIndex++}`);
      values.push(data.icon);
    }
    
    if (data.iconSize !== undefined) {
      updates.push(`"iconSize" = $${paramIndex++}`);
      values.push(data.iconSize);
    }
    
    if (data.iconColor !== undefined) {
      updates.push(`"iconColor" = $${paramIndex++}`);
      values.push(data.iconColor);
    }
    
    if (data.radius !== undefined) {
      updates.push(`"radius" = $${paramIndex++}`);
      values.push(data.radius);
    }
    
    if (data.lore !== undefined) {
      updates.push(`"lore" = $${paramIndex++}`);
      values.push(data.lore);
    }
    
    if (data.spoilers !== undefined) {
      updates.push(`"spoilers" = $${paramIndex++}`);
      values.push(data.spoilers);
    }
    
    if (data.isCoordinateSearch !== undefined) {
      updates.push(`"isCoordinateSearch" = $${paramIndex++}`);
      values.push(data.isCoordinateSearch);
    }
    
    if (data.noCluster !== undefined) {
      updates.push(`"noCluster" = $${paramIndex++}`);
      values.push(data.noCluster);
    }
    
    if (data.mediaUrl !== undefined) {
      updates.push(`"mediaUrl" = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(data.mediaUrl));
    }
    
    if (data.exactCoordinates !== undefined) {
      updates.push(`"exactCoordinates" = $${paramIndex++}::jsonb`);
      values.push(data.exactCoordinates !== null ? JSON.stringify(data.exactCoordinates) : null);
    }
    
    if (data.submittedBy !== undefined) {
      updates.push(`"submittedBy" = $${paramIndex++}`);
      values.push(data.submittedBy);
    }
    
    if (data.approvedBy !== undefined) {
      updates.push(`"approvedBy" = $${paramIndex++}`);
      values.push(data.approvedBy);
    }
    
    // Always update lastModified timestamp
    updates.push(`"lastModified" = CURRENT_TIMESTAMP`);
    
    // Execute the update if we have fields to update
    if (updates.length > 0) {
      const updateQuery = `
        UPDATE "Location"
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Location with ID ${id} not found`);
      }
      
      await client.query('COMMIT');
      return result.rows[0];
    } else {
      // No fields to update, just return the current location
      const result = await client.query('SELECT * FROM "Location" WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        throw new Error(`Location with ID ${id} not found`);
      }
      
      await client.query('COMMIT');
      return result.rows[0];
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating location:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Export default object with all functions
export default {
  getClient,
  query,
  queryOne,
  getPrismaClient,
  closeConnections,
  setupListener,
  getLocationsByCategory,
  getCategoryDefaults,
  saveCategoryDefault,
  deleteCategoryDefault,
  normalizeCoordinates,
  saveLocation,
  updateLocation
};
