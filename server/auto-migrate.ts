/**
 * Auto Migration
 * Automatically adds missing columns to the database on server startup.
 * This avoids the need to run manual SQL commands after deployment.
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

interface MigrationStep {
  name: string;
  check: string;   // SQL to check if migration is needed (returns rows if already done)
  apply: string;    // SQL to apply the migration
}

const migrations: MigrationStep[] = [
  {
    name: "Add barcode column to medicines",
    check: `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'medicines' AND COLUMN_NAME = 'barcode' 
            LIMIT 1`,
    apply: `ALTER TABLE medicines ADD COLUMN barcode varchar(100) DEFAULT NULL`,
  },
];

export async function runAutoMigrations(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[AutoMigrate] Database not available, skipping migrations");
    return;
  }

  console.log("[AutoMigrate] Checking for pending migrations...");

  for (const migration of migrations) {
    try {
      // Check if migration is already applied
      const rows = await db.execute(sql.raw(migration.check));
      const result = (rows as any)?.[0] ?? rows;

      if (result && result.length > 0) {
        // Migration already applied
        console.log(`[AutoMigrate] ✓ "${migration.name}" - already applied`);
        continue;
      }

      // Apply migration
      console.log(`[AutoMigrate] Applying: "${migration.name}"...`);
      await db.execute(sql.raw(migration.apply));
      console.log(`[AutoMigrate] ✓ "${migration.name}" - applied successfully`);
    } catch (error: any) {
      // If error is "Duplicate column", it means it already exists
      if (error.message?.includes("Duplicate column")) {
        console.log(`[AutoMigrate] ✓ "${migration.name}" - already exists`);
      } else {
        console.error(`[AutoMigrate] ✗ "${migration.name}" - failed:`, error.message);
      }
    }
  }

  console.log("[AutoMigrate] Migration check complete");
}
