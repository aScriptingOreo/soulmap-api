import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the migration SQL file
const migrationSqlPath = path.join(__dirname, '..', '..', 'prisma', 'migrations', '20240630000000_add_heatmap_tables', 'migration.sql');

/**
 * Creates the heatmap tables if they don't exist
 */
export async function ensureHeatmapTablesExist() {
  let prisma = null;

  try {
    // console.log("Checking if heatmap tables exist...");

    // Create a new Prisma client
    prisma = new PrismaClient();

    // Try to query the HeatmapType table
    try {
      await prisma.heatmapType.count();
      // console.log("Heatmap tables already exist.");
      return { success: true, message: "Tables already exist" };
    } catch (error) {
      // If error code is P2021, the table doesn't exist
      if (error.code === 'P2021') {
        console.log("Heatmap tables don't exist. Creating them...");

        // Read the migration SQL
        let migrationSql;
        try {
          migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');
        } catch (readError) {
          console.error("Failed to read migration SQL file:", readError);
          throw new Error("Migration file not found or cannot be read");
        }

        // Execute the SQL directly
        try {
          // Using $executeRawUnsafe to execute multiple SQL statements
          const statements = migrationSql
            .split(';') // Split by semicolon to get individual statements
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0); // Remove empty statements

          for (const statement of statements) {
            await prisma.$executeRawUnsafe(`${statement};`);
          }

          console.log("Successfully created heatmap tables");
          return { success: true, message: "Tables created successfully" };
        } catch (sqlError) {
          console.error("Failed to execute migration SQL:", sqlError);
          throw new Error("Failed to create tables");
        }
      } else {
        // Some other error occurred
        console.error("Unexpected error checking for heatmap tables:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("Error ensuring heatmap tables exist:", error);
    return { success: false, message: error.message };
  } finally {
    // Close the Prisma client
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Alternative approach using prisma migrate command
 */
export async function runPrismaMigrate() {
  return new Promise((resolve, reject) => {
    // Get the root directory path (2 levels up from this file)
    const rootDir = path.resolve(__dirname, '..', '..');
    const prismaPath = path.join(rootDir, 'node_modules', '.bin', 'prisma');

    console.log("Running Prisma migrations...");
    console.log(`Command: ${prismaPath} migrate deploy`);
    console.log(`Working directory: ${rootDir}`);

    // Execute the prisma migrate deploy command
    exec(`${prismaPath} migrate deploy`, { cwd: rootDir }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Prisma migrate error: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        reject(error);
        return;
      }

      console.log(`Prisma migrate output: ${stdout}`);
      resolve({ success: true, message: "Migration completed" });
    });
  });
}

export default {
  ensureHeatmapTablesExist,
  runPrismaMigrate
};
