import { eq, desc, asc, sql, and, like, or, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  categories, InsertCategory,
  medicines, InsertMedicine,
  banners, InsertBanner,
  customers, InsertCustomer,
  orders, InsertOrder,
  orderItems, InsertOrderItem,
  adminCredentials, InsertAdminCredential,
  searchLogs, InsertSearchLog,
  appSettings, InsertAppSetting,
  pushTokens, InsertPushToken,
  stockAlerts, InsertStockAlert,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== USER FUNCTIONS =====
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== CATEGORY FUNCTIONS =====
export async function getCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).orderBy(categories.sortOrder);
}

export async function getActiveCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.sortOrder);
}

export async function createCategory(data: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values(data);
  return result[0].insertId;
}

export async function updateCategory(id: number, data: Partial<InsertCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(categories).set(data).where(eq(categories.id, id));
}

export async function deleteCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(categories).where(eq(categories.id, id));
}

// ===== MEDICINE FUNCTIONS =====
export async function getMedicines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicines).where(eq(medicines.isActive, true)).orderBy(asc(medicines.nameAr), asc(medicines.nameEn));
}

export async function getAllMedicines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicines).orderBy(asc(medicines.nameAr), asc(medicines.nameEn));
}

export async function getAllMedicinesAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicines).orderBy(asc(medicines.nameAr), asc(medicines.nameEn));
}

export async function getMedicinesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicines).where(and(eq(medicines.categoryId, categoryId), eq(medicines.isActive, true)));
}

// Normalize Arabic characters for search
// أ إ آ ا → ا | ة → ه | ي ى → ي | و ؤ → و | remove tashkeel
function normalizeArabic(text: string): string {
  return text
    .replace(/[\u0623\u0625\u0622]/g, '\u0627') // أ إ آ → ا
    .replace(/[\u0629]/g, '\u0647') // ة → ه
    .replace(/[\u0649]/g, '\u064A') // ى → ي
    .replace(/[\u0624]/g, '\u0648') // ؤ → و
    .replace(/[\u064B-\u065F\u0670]/g, ''); // remove tashkeel
}

// ===== LEVENSHTEIN DISTANCE (Fuzzy Matching) =====
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  
  // Use single array optimization for memory efficiency
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Check if query approximately matches a word in the name
// Returns best distance found (0 = exact, 1 = one char diff, etc.)
function fuzzyWordMatch(query: string, name: string): number {
  const queryWords = query.split(/\s+/).filter(w => w.length > 0);
  const nameWords = name.split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length === 0) return 999;
  
  let totalDistance = 0;
  
  for (const qWord of queryWords) {
    let bestDist = 999;
    
    // Compare against each word in the name
    for (const nWord of nameWords) {
      const dist = levenshteinDistance(qWord, nWord);
      bestDist = Math.min(bestDist, dist);
    }
    
    // Also check substring matching for the full name
    // e.g., "بنادول" vs "بانادول" - check against the full name too
    const fullDist = levenshteinDistance(qWord, name);
    // For substring: slide a window of qWord length (+/- 2) across the name
    for (let len = Math.max(1, qWord.length - 2); len <= qWord.length + 2 && len <= name.length; len++) {
      for (let start = 0; start + len <= name.length; start++) {
        const sub = name.substring(start, start + len);
        const subDist = levenshteinDistance(qWord, sub);
        bestDist = Math.min(bestDist, subDist);
      }
    }
    
    totalDistance += bestDist;
  }
  
  return totalDistance;
}

// Calculate max allowed distance based on word length
function getMaxDistance(wordLength: number): number {
  if (wordLength <= 3) return 1;  // short words: 1 char tolerance
  if (wordLength <= 6) return 2;  // medium words: 2 char tolerance
  return 3;                        // long words: 3 char tolerance
}

// ===== SEARCH CACHE =====
interface SearchCacheEntry {
  results: any[];
  timestamp: number;
}
const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SEARCH_CACHE_MAX_SIZE = 200;

function cleanSearchCache() {
  const now = Date.now();
  for (const [key, entry] of searchCache.entries()) {
    if (now - entry.timestamp > SEARCH_CACHE_TTL) {
      searchCache.delete(key);
    }
  }
  // If still too large, remove oldest entries
  if (searchCache.size > SEARCH_CACHE_MAX_SIZE) {
    const entries = Array.from(searchCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - SEARCH_CACHE_MAX_SIZE);
    toRemove.forEach(([key]) => searchCache.delete(key));
  }
}

// Invalidate search cache when medicines are modified
export function invalidateSearchCache() {
  searchCache.clear();
}

export async function searchMedicines(query: string) {
  const db = await getDb();
  if (!db) return [];
  
  const normalizedQuery = normalizeArabic(query.toLowerCase().trim());
  
  // Check cache first
  const cacheKey = normalizedQuery;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.results;
  }
  
  const allMeds = await db.select().from(medicines).where(eq(medicines.isActive, true));
  
  // Split query into fragments for sequential fuzzy matching
  const fragments = normalizedQuery.split(/\s+/).filter(f => f.length > 0);
  
  if (fragments.length === 0) return [];
  
  // Escape special regex characters in each fragment
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Build a regex pattern: fragment1.*fragment2.*fragment3...
  const pattern = fragments.map(f => escapeRegex(f)).join('.*');
  const regex = new RegExp(pattern, 'i');
  
  // Score function: lower score = better match (closer to exact match)
  function getMatchScore(med: any): number {
    const nameAr = normalizeArabic((med.nameAr || '').toLowerCase());
    const nameEn = (med.nameEn || '').toLowerCase();
    const fullQuery = fragments.join('');
    
    // Exact match gets highest priority
    if (nameAr === normalizedQuery || nameEn === normalizedQuery) return 0;
    
    // Starts with query
    if (nameAr.startsWith(normalizedQuery) || nameEn.startsWith(normalizedQuery)) return 1;
    if (nameAr.startsWith(fullQuery) || nameEn.startsWith(fullQuery)) return 2;
    
    // Contains query as substring (no gaps)
    if (nameAr.includes(fullQuery) || nameEn.includes(fullQuery)) return 3;
    
    // Fuzzy match - score by total gap length (shorter gaps = better)
    const matchInName = (name: string): number => {
      const match = name.match(regex);
      if (!match) return 999;
      return match[0].length - fullQuery.length; // gap size
    };
    
    const gapAr = matchInName(nameAr);
    const gapEn = matchInName(nameEn);
    return 4 + Math.min(gapAr, gapEn);
  }
  
  // Phase 1: Exact/regex matching (fast)
  const exactResults = allMeds
    .filter(med => {
      const nameAr = normalizeArabic((med.nameAr || '').toLowerCase());
      const nameEn = (med.nameEn || '').toLowerCase();
      const combined = nameAr + ' ' + nameEn;
      return regex.test(nameAr) || regex.test(nameEn) || regex.test(combined);
    })
    .map(med => ({ ...med, _score: getMatchScore(med) }));
  
  // Phase 2: Fuzzy matching with Levenshtein (only if exact results are few)
  // This catches voice search errors like "بنادول" instead of "بانادول"
  const maxDist = getMaxDistance(normalizedQuery.length);
  let fuzzyResults: typeof exactResults = [];
  
  if (exactResults.length < 5) {
    const exactIds = new Set(exactResults.map(m => m.id));
    fuzzyResults = allMeds
      .filter(med => !exactIds.has(med.id)) // Skip already matched
      .map(med => {
        const nameAr = normalizeArabic((med.nameAr || '').toLowerCase());
        const nameEn = (med.nameEn || '').toLowerCase();
        
        const distAr = fuzzyWordMatch(normalizedQuery, nameAr);
        const distEn = fuzzyWordMatch(normalizedQuery, nameEn);
        const bestDist = Math.min(distAr, distEn);
        
        return { ...med, _score: bestDist <= maxDist ? 100 + bestDist : 999 };
      })
      .filter(med => med._score < 999);
  }
  
  // Combine and sort
  const results = [...exactResults, ...fuzzyResults]
    .sort((a, b) => a._score - b._score)
    .map(({ _score, ...med }) => med); // Remove score from output
  
  // Store in cache
  searchCache.set(cacheKey, { results, timestamp: Date.now() });
  cleanSearchCache();
  
  return results;
}

export async function getMedicineById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(medicines).where(eq(medicines.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getMedicineByBarcode(barcode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(medicines).where(eq(medicines.barcode, barcode)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMedicine(data: InsertMedicine) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(medicines).values(data);
  return result[0].insertId;
}

export async function updateMedicine(id: number, data: Partial<InsertMedicine>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(medicines).set(data).where(eq(medicines.id, id));
}

export async function deleteMedicine(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(medicines).where(eq(medicines.id, id));
}

// ===== BANNER FUNCTIONS =====
export async function getActiveBanners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(banners).where(eq(banners.isActive, true)).orderBy(banners.sortOrder);
}

export async function getAllBanners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(banners).orderBy(banners.sortOrder);
}

export async function createBanner(data: InsertBanner) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(banners).values(data);
  return result[0].insertId;
}

export async function updateBanner(id: number, data: Partial<InsertBanner>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(banners).set(data).where(eq(banners.id, id));
}

export async function deleteBanner(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(banners).where(eq(banners.id, id));
}

// ===== CUSTOMER FUNCTIONS =====
export async function getOrCreateCustomer(deviceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(customers).where(eq(customers.deviceId, deviceId)).limit(1);
  if (existing.length > 0) return existing[0];
  const result = await db.insert(customers).values({ deviceId });
  const newCustomer = await db.select().from(customers).where(eq(customers.id, result[0].insertId)).limit(1);
  return newCustomer[0];
}

export async function updateCustomer(deviceId: string, data: { fullName?: string; phone?: string; address?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // When customer updates their profile with real data, set status to pending for admin approval
  const updateData: any = { ...data };
  if (data.fullName && data.phone) {
    updateData.status = "pending";
  }
  await db.update(customers).set(updateData).where(eq(customers.deviceId, deviceId));
}

export async function getCustomerByDeviceId(deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.deviceId, deviceId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Get all customers for admin
export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(customers).orderBy(desc(customers.createdAt));
}

// Approve customer
export async function approveCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set({ status: "approved" }).where(eq(customers.id, id));
}

// Reject customer
export async function rejectCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set({ status: "rejected" }).where(eq(customers.id, id));
}

// Toggle customer active status
export async function toggleCustomerActive(id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(customers).set({ isActive }).where(eq(customers.id, id));
}

// Delete customer
export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(customers).where(eq(customers.id, id));
}

// ===== ORDER FUNCTIONS =====

// Check stock availability before placing order
export async function validateOrderStock(items: { medicineId: number; medicineName: string; quantity: number }[]): Promise<{ valid: boolean; errors: string[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const errors: string[] = [];
  
  for (const item of items) {
    const med = await db.select().from(medicines).where(eq(medicines.id, item.medicineId)).limit(1);
    if (med.length === 0) {
      errors.push(`الصنف "${item.medicineName}" غير موجود`);
    } else if (med[0].stock !== null && med[0].stock !== undefined && med[0].stock < item.quantity) {
      if (med[0].stock === 0) {
        errors.push(`الصنف "${item.medicineName}" غير متوفر حالياً`);
      } else {
        errors.push(`الصنف "${item.medicineName}" - الكمية المطلوبة (${item.quantity}) أكبر من المتوفر (${med[0].stock})`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Deduct stock after order is created
export async function deductStock(items: { medicineId: number; quantity: number }[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const item of items) {
    await db.update(medicines)
      .set({ stock: sql`GREATEST(${medicines.stock} - ${item.quantity}, 0)` })
      .where(eq(medicines.id, item.medicineId));
  }
  // Invalidate search cache since stock changed
  invalidateSearchCache();
}

export async function createOrder(data: InsertOrder, items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(data);
  const orderId = result[0].insertId;
  if (items.length > 0) {
    await db.insert(orderItems).values(items.map(item => ({ ...item, orderId })));
  }
  return orderId;
}

export async function getOrdersByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt));
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getAllOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(id: number, status: "received" | "preparing" | "shipped" | "delivered") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

// ===== ADMIN FUNCTIONS =====
export async function verifyAdmin(username: string, password: string) {
  // Check database first (in case password was changed)
  const db = await getDb();
  if (db) {
    // Check if admin exists in database at all
    const adminExists = await db.select().from(adminCredentials).where(
      eq(adminCredentials.username, username)
    ).limit(1);
    if (adminExists.length > 0) {
      // Admin exists in DB - ONLY verify against DB password (ignore env vars)
      return adminExists[0].password === password;
    }
  }
  // No admin in DB yet - fallback to env vars for initial setup
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  if (envUser && envPass) {
    return username === envUser && password === envPass;
  }
  return false;
}

export async function createAdminIfNotExists(username: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(adminCredentials).where(eq(adminCredentials.username, username)).limit(1);
  if (existing.length === 0) {
    await db.insert(adminCredentials).values({ username, password });
  }
}

export async function deleteOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderItems).where(eq(orderItems.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
}

export async function resetSalesReport() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(orderItems);
  await db.delete(orders);
}

// ===== REPORTS FUNCTIONS =====
export async function getSalesReport() {
  const db = await getDb();
  if (!db) return { totalOrders: 0, totalRevenue: "0", ordersByStatus: [] };
  const totalOrders = await db.select({ count: sql<number>`COUNT(*)` }).from(orders);
  const totalRevenue = await db.select({ total: sql<string>`COALESCE(SUM(totalAmount), 0)` }).from(orders);
  const ordersByStatus = await db.select({
    status: orders.status,
    count: sql<number>`COUNT(*)`,
    revenue: sql<string>`COALESCE(SUM(totalAmount), 0)`,
  }).from(orders).groupBy(orders.status);
  return {
    totalOrders: totalOrders[0]?.count ?? 0,
    totalRevenue: totalRevenue[0]?.total ?? "0",
    ordersByStatus,
  };
}

// ===== ADVANCED STATISTICS =====
export async function getAdvancedStats() {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, approvedCustomers: 0, pendingCustomers: 0, avgOrderValue: '0', totalMedicines: 0, outOfStockCount: 0, topCustomers: [] };
  
  // Total customers
  const totalCustomers = await db.select({ count: sql<number>`COUNT(*)` }).from(customers);
  
  // Approved customers
  const approvedCustomers = await db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(eq(customers.status, 'approved'));
  
  // Pending customers
  const pendingCustomers = await db.select({ count: sql<number>`COUNT(*)` }).from(customers).where(eq(customers.status, 'pending'));
  
  // Average order value
  const avgOrder = await db.select({ avg: sql<string>`COALESCE(AVG(CAST(totalAmount AS DECIMAL(10,2))), 0)` }).from(orders);
  
  // Total active medicines
  const totalMedicines = await db.select({ count: sql<number>`COUNT(*)` }).from(medicines).where(eq(medicines.isActive, true));
  
  // Out of stock count
  const outOfStock = await db.select({ count: sql<number>`COUNT(*)` }).from(medicines).where(and(eq(medicines.isActive, true), sql`${medicines.stock} = 0`));
  
  // Top 10 customers by order count and total spending
  const topCustomers = await db.select({
    customerId: orders.customerId,
    customerName: orders.customerName,
    orderCount: sql<number>`COUNT(*)`,
    totalSpent: sql<string>`COALESCE(SUM(CAST(totalAmount AS DECIMAL(10,2))), 0)`,
  })
    .from(orders)
    .groupBy(orders.customerId, orders.customerName)
    .orderBy(desc(sql`SUM(CAST(totalAmount AS DECIMAL(10,2)))`))
    .limit(10);
  
  return {
    totalCustomers: totalCustomers[0]?.count ?? 0,
    approvedCustomers: approvedCustomers[0]?.count ?? 0,
    pendingCustomers: pendingCustomers[0]?.count ?? 0,
    avgOrderValue: parseFloat(avgOrder[0]?.avg ?? '0').toFixed(2),
    totalMedicines: totalMedicines[0]?.count ?? 0,
    outOfStockCount: outOfStock[0]?.count ?? 0,
    topCustomers,
  };
}

// ===== SEARCH LOG FUNCTIONS (Rate Limiting) =====
export async function logSearch(deviceId: string, query: string, customerId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(searchLogs).values({ deviceId, query, customerId: customerId ?? null });
}

export async function getSearchCountToday(deviceId: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(searchLogs)
    .where(and(
      eq(searchLogs.deviceId, deviceId),
      gte(searchLogs.createdAt, todayStart)
    ));
  return result[0]?.count ?? 0;
}

// Get top searchers today (for admin alerts)
export async function getTopSearchersToday(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const result = await db.select({
    deviceId: searchLogs.deviceId,
    count: sql<number>`COUNT(*)`,
  })
    .from(searchLogs)
    .where(gte(searchLogs.createdAt, todayStart))
    .groupBy(searchLogs.deviceId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
  return result;
}

// ===== APP SETTINGS FUNCTIONS =====
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(appSettings).where(eq(appSettings.settingKey, key)).limit(1);
  return result.length > 0 ? result[0].settingValue : null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(appSettings).values({ settingKey: key, settingValue: value })
    .onDuplicateKeyUpdate({ set: { settingValue: value } });
}

// Check if loyalty program is enabled
export async function isLoyaltyEnabled(): Promise<boolean> {
  const value = await getSetting("loyalty_enabled");
  return value !== "false"; // Default is enabled
}

// ===== CHANGE ADMIN PASSWORD =====
export async function changeAdminPassword(username: string, currentPassword: string, newPassword: string): Promise<boolean> {
  // First verify the current password using the same logic as verifyAdmin
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let isVerified = false;
  
  // Check against env vars first
  if (envUser && envPass) {
    isVerified = (username === envUser && currentPassword === envPass);
  }
  
  // Also check against database
  if (!isVerified) {
    const existing = await db.select().from(adminCredentials).where(
      and(eq(adminCredentials.username, username), eq(adminCredentials.password, currentPassword))
    ).limit(1);
    isVerified = existing.length > 0;
  }
  
  if (!isVerified) return false;
  
  // Update or create the admin credentials in the database with new password
  const existingAdmin = await db.select().from(adminCredentials).where(eq(adminCredentials.username, username)).limit(1);
  if (existingAdmin.length > 0) {
    await db.update(adminCredentials).set({ password: newPassword }).where(eq(adminCredentials.username, username));
  } else {
    // Admin was using env vars only, create DB entry with new password
    await db.insert(adminCredentials).values({ username, password: newPassword });
  }
  return true;
}

// ===== PUSH TOKEN FUNCTIONS =====
export async function registerPushToken(token: string, deviceId?: string, customerId?: number, isAdmin: boolean = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(pushTokens).values({ token, deviceId: deviceId ?? null, customerId: customerId ?? null, isAdmin })
    .onDuplicateKeyUpdate({ set: { deviceId: deviceId ?? null, customerId: customerId ?? null, isAdmin, updatedAt: new Date() } });
}

export async function getAdminPushTokens(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.isAdmin, true));
  return results.map(r => r.token);
}

export async function getCustomerPushTokens(customerId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.customerId, customerId));
  return results.map(r => r.token);
}

export async function removePushToken(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushTokens).where(eq(pushTokens.token, token));
}

// Get all push tokens (for broadcast notifications)
export async function getAllPushTokens(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({ token: pushTokens.token }).from(pushTokens);
  return results.map(r => r.token);
}

// Get customer-only push tokens (exclude admin)
export async function getCustomerOnlyPushTokens(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.isAdmin, false));
  return results.map(r => r.token);
}

// Get push token count
export async function getPushTokenCount(): Promise<{ total: number; admin: number; customers: number }> {
  const db = await getDb();
  if (!db) return { total: 0, admin: 0, customers: 0 };
  const all = await db.select({ token: pushTokens.token }).from(pushTokens);
  const admins = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.isAdmin, true));
  return { total: all.length, admin: admins.length, customers: all.length - admins.length };
}

// ===== MOST ORDERED (POPULAR) MEDICINES =====
export async function getMostOrderedMedicines(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    medicineId: orderItems.medicineId,
    medicineName: orderItems.medicineName,
    totalOrdered: sql<number>`SUM(${orderItems.quantity})`,
    orderCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
  })
    .from(orderItems)
    .groupBy(orderItems.medicineId, orderItems.medicineName)
    .orderBy(desc(sql`SUM(${orderItems.quantity})`))
    .limit(limit);
  return result;
}

// ===== LOW STOCK ALERT =====
export async function getLowStockMedicines(threshold: number = 5) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select()
    .from(medicines)
    .where(and(
      eq(medicines.isActive, true),
      sql`${medicines.stock} <= ${threshold}`
    ))
    .orderBy(medicines.stock);
  return result;
}

// ===== DAILY ORDERS REPORT =====
export async function getDailyOrdersReport(date?: Date) {
  const db = await getDb();
  if (!db) return { date: '', totalOrders: 0, totalRevenue: '0', orders: [], topItems: [] };
  
  const targetDate = date || new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);
  
  // Get orders for the day
  const dayOrders = await db.select().from(orders)
    .where(and(
      gte(orders.createdAt, dayStart),
      sql`${orders.createdAt} <= ${dayEnd}`
    ))
    .orderBy(desc(orders.createdAt));
  
  // Calculate totals
  const totalOrders = dayOrders.length;
  const totalRevenue = dayOrders.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0).toFixed(2);
  
  // Get top items for the day
  const orderIds = dayOrders.map(o => o.id);
  let topItems: any[] = [];
  if (orderIds.length > 0) {
    topItems = await db.select({
      medicineName: orderItems.medicineName,
      totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
      totalRevenue: sql<string>`COALESCE(SUM(CAST(${orderItems.price} AS DECIMAL(10,2)) * ${orderItems.quantity}), 0)`,
    })
      .from(orderItems)
      .where(sql`${orderItems.orderId} IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(orderItems.medicineName)
      .orderBy(desc(sql`SUM(${orderItems.quantity})`));
  }
  
  return {
    date: dayStart.toISOString().split('T')[0],
    totalOrders,
    totalRevenue,
    orders: dayOrders,
    topItems,
  };
}

// ===== STOCK ALERTS (Notify When Available) =====

// Register a stock alert - customer wants to be notified when medicine is back in stock
export async function registerStockAlert(customerId: number, medicineId: number, deviceId?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if already registered
  const existing = await db.select().from(stockAlerts)
    .where(and(eq(stockAlerts.customerId, customerId), eq(stockAlerts.medicineId, medicineId)))
    .limit(1);
  
  if (existing.length > 0) {
    return { alreadyRegistered: true };
  }
  
  await db.insert(stockAlerts).values({ customerId, medicineId, deviceId: deviceId ?? null });
  return { alreadyRegistered: false };
}

// Remove a stock alert
export async function removeStockAlert(customerId: number, medicineId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(stockAlerts).where(and(eq(stockAlerts.customerId, customerId), eq(stockAlerts.medicineId, medicineId)));
}

// Check if customer has a stock alert for a medicine
export async function hasStockAlert(customerId: number, medicineId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(stockAlerts)
    .where(and(eq(stockAlerts.customerId, customerId), eq(stockAlerts.medicineId, medicineId)))
    .limit(1);
  return result.length > 0;
}

// Get all stock alerts for a specific medicine (to notify when back in stock)
export async function getStockAlertsForMedicine(medicineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockAlerts).where(eq(stockAlerts.medicineId, medicineId));
}

// Delete all stock alerts for a medicine (after sending notifications)
export async function clearStockAlertsForMedicine(medicineId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(stockAlerts).where(eq(stockAlerts.medicineId, medicineId));
}

// Get customer push tokens for stock alert notifications
export async function getStockAlertCustomerTokens(medicineId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  
  // Get customer IDs who registered for this alert
  const alerts = await db.select({ customerId: stockAlerts.customerId }).from(stockAlerts)
    .where(eq(stockAlerts.medicineId, medicineId));
  
  if (alerts.length === 0) return [];
  
  const customerIds = alerts.map(a => a.customerId);
  
  // Get push tokens for these customers
  const tokens: string[] = [];
  for (const cid of customerIds) {
    const results = await db.select({ token: pushTokens.token }).from(pushTokens)
      .where(eq(pushTokens.customerId, cid));
    tokens.push(...results.map(r => r.token));
  }
  
  return tokens;
}

// Get all stock alerts with customer and medicine details (for admin)
export async function getAllStockAlertsWithDetails() {
  const db = await getDb();
  if (!db) return [];
  const alerts = await db.select({
    alertId: stockAlerts.id,
    customerId: stockAlerts.customerId,
    medicineId: stockAlerts.medicineId,
    createdAt: stockAlerts.createdAt,
    customerName: customers.fullName,
    customerPhone: customers.phone,
    customerAddress: customers.address,
    medicineName: medicines.nameAr,
    medicineNameEn: medicines.nameEn,
    medicineStock: medicines.stock,
  })
  .from(stockAlerts)
  .innerJoin(customers, eq(stockAlerts.customerId, customers.id))
  .innerJoin(medicines, eq(stockAlerts.medicineId, medicines.id))
  .orderBy(desc(stockAlerts.createdAt));
  return alerts;
}

// Get stock alert count for a medicine
export async function getStockAlertCount(medicineId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(stockAlerts)
    .where(eq(stockAlerts.medicineId, medicineId));
  return result[0]?.count || 0;
}
