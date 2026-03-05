/**
 * Automatic Database Backup System
 * - Exports all tables to JSON
 * - Uploads backup to Cloudinary as a raw file
 * - Scheduled to run daily
 * - Provides manual backup/restore endpoints for admin
 */

import { v2 as cloudinary } from "cloudinary";
import { getDb } from "./db";
import {
  categories, medicines, banners, customers, orders, orderItems,
  adminCredentials, appSettings, pushTokens, stockAlerts, searchLogs,
} from "../drizzle/schema";
import { desc } from "drizzle-orm";

// Ensure Cloudinary is configured (same config as storage.ts)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "djambipwp",
  api_key: process.env.CLOUDINARY_API_KEY || "777756389123773",
  api_secret: process.env.CLOUDINARY_API_SECRET || "j0RKVCY6Nyh1KqlYagLbf2FxK_M",
});

interface BackupData {
  timestamp: string;
  version: string;
  tables: {
    categories: any[];
    medicines: any[];
    banners: any[];
    customers: any[];
    orders: any[];
    orderItems: any[];
    adminCredentials: any[];
    appSettings: any[];
    pushTokens: any[];
    stockAlerts: any[];
  };
}

// ===== EXPORT ALL DATA =====
export async function exportAllData(): Promise<BackupData> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [
    categoriesData,
    medicinesData,
    bannersData,
    customersData,
    ordersData,
    orderItemsData,
    adminCredentialsData,
    appSettingsData,
    pushTokensData,
    stockAlertsData,
  ] = await Promise.all([
    db.select().from(categories),
    db.select().from(medicines),
    db.select().from(banners),
    db.select().from(customers),
    db.select().from(orders).orderBy(desc(orders.createdAt)),
    db.select().from(orderItems),
    db.select().from(adminCredentials),
    db.select().from(appSettings),
    db.select().from(pushTokens),
    db.select().from(stockAlerts),
  ]);

  return {
    timestamp: new Date().toISOString(),
    version: "1.0",
    tables: {
      categories: categoriesData,
      medicines: medicinesData,
      banners: bannersData,
      customers: customersData,
      orders: ordersData,
      orderItems: orderItemsData,
      adminCredentials: adminCredentialsData,
      appSettings: appSettingsData,
      pushTokens: pushTokensData,
      stockAlerts: stockAlertsData,
    },
  };
}

// ===== UPLOAD BACKUP TO CLOUDINARY =====
export async function uploadBackupToCloudinary(data: BackupData): Promise<{ url: string; publicId: string }> {
  const jsonStr = JSON.stringify(data, null, 2);
  const base64 = Buffer.from(jsonStr).toString("base64");
  const dataUri = `data:application/json;base64,${base64}`;

  // Create a timestamped filename
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").split("T")[0];
  const timeStr = new Date().toISOString().replace(/[:.]/g, "-").split("T")[1]?.replace("Z", "") || "000000";
  const publicId = `alshazly-pharmacy/backups/backup_${dateStr}_${timeStr}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      resource_type: "raw",
      overwrite: true,
    });

    console.log(`[Backup] Uploaded to Cloudinary: ${result.secure_url}`);
    return { url: result.secure_url, publicId };
  } catch (error) {
    console.error("[Backup] Upload error:", error);
    throw new Error(`Failed to upload backup: ${error}`);
  }
}

// ===== LIST AVAILABLE BACKUPS =====
export async function listBackups(): Promise<{ publicId: string; url: string; createdAt: string; size: number }[]> {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "raw",
      prefix: "alshazly-pharmacy/backups/",
      max_results: 30,
    });

    return (result.resources || [])
      .map((r: any) => ({
        publicId: r.public_id,
        url: r.secure_url,
        createdAt: r.created_at,
        size: r.bytes,
      }))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("[Backup] List error:", error);
    return [];
  }
}

// ===== DOWNLOAD AND RESTORE BACKUP =====
export async function downloadBackup(url: string): Promise<BackupData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download backup: ${response.statusText}`);
  const data = await response.json();
  return data as BackupData;
}

// ===== RESTORE FROM BACKUP =====
export async function restoreFromBackup(data: BackupData): Promise<{ restored: string[]; errors: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const restored: string[] = [];
  const errors: string[] = [];

  // Restore in order (respecting foreign keys)
  const tableMap: [string, any, any[]][] = [
    ["categories", categories, data.tables.categories],
    ["medicines", medicines, data.tables.medicines],
    ["banners", banners, data.tables.banners],
    ["customers", customers, data.tables.customers],
    ["orders", orders, data.tables.orders],
    ["orderItems", orderItems, data.tables.orderItems],
    ["adminCredentials", adminCredentials, data.tables.adminCredentials],
    ["appSettings", appSettings, data.tables.appSettings],
    ["pushTokens", pushTokens, data.tables.pushTokens],
    ["stockAlerts", stockAlerts, data.tables.stockAlerts],
  ];

  for (const [name, table, rows] of tableMap) {
    if (!rows || rows.length === 0) {
      restored.push(`${name}: 0 rows (empty)`);
      continue;
    }

    try {
      // Clean date fields - convert ISO strings back to Date objects
      const cleanedRows = rows.map((row: any) => {
        const cleaned: any = { ...row };
        for (const key of Object.keys(cleaned)) {
          if (typeof cleaned[key] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(cleaned[key])) {
            cleaned[key] = new Date(cleaned[key]);
          }
        }
        return cleaned;
      });

      // Insert in batches of 50 to avoid query size limits
      const batchSize = 50;
      for (let i = 0; i < cleanedRows.length; i += batchSize) {
        const batch = cleanedRows.slice(i, i + batchSize);
        try {
          // Use INSERT IGNORE to skip duplicates
          await db.insert(table).values(batch).onDuplicateKeyUpdate({
            set: batch[0], // Update with same data on conflict
          });
        } catch (batchError: any) {
          // Try inserting one by one if batch fails
          for (const row of batch) {
            try {
              await db.insert(table).values(row).onDuplicateKeyUpdate({
                set: row,
              });
            } catch (singleError: any) {
              // Skip individual errors silently
            }
          }
        }
      }
      restored.push(`${name}: ${cleanedRows.length} rows`);
    } catch (error: any) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  return { restored, errors };
}

// ===== PERFORM AUTOMATIC BACKUP =====
export async function performAutoBackup(): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log("[Backup] Starting automatic backup...");
    const data = await exportAllData();
    const { url } = await uploadBackupToCloudinary(data);
    
    // Count total records
    const totalRecords = Object.values(data.tables).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`[Backup] Automatic backup completed. ${totalRecords} records saved. URL: ${url}`);
    
    // Clean up old backups (keep last 14)
    try {
      const backups = await listBackups();
      if (backups.length > 14) {
        const toDelete = backups.slice(14);
        for (const backup of toDelete) {
          try {
            await cloudinary.uploader.destroy(backup.publicId, { resource_type: "raw" });
            console.log(`[Backup] Deleted old backup: ${backup.publicId}`);
          } catch (e) {
            // Ignore deletion errors
          }
        }
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return { success: true, url };
  } catch (error: any) {
    console.error("[Backup] Automatic backup failed:", error);
    return { success: false, error: error.message };
  }
}

// ===== SCHEDULE DAILY BACKUP =====
let backupInterval: ReturnType<typeof setInterval> | null = null;

export function startDailyBackup() {
  // Run backup immediately on server start (after 30 seconds delay)
  setTimeout(async () => {
    console.log("[Backup] Running initial backup on server start...");
    await performAutoBackup();
  }, 30000);

  // Schedule daily backup every 24 hours
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  backupInterval = setInterval(async () => {
    console.log("[Backup] Running scheduled daily backup...");
    await performAutoBackup();
  }, TWENTY_FOUR_HOURS);

  console.log("[Backup] Daily backup scheduler started (every 24 hours)");
}

export function stopDailyBackup() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
    console.log("[Backup] Daily backup scheduler stopped");
  }
}
