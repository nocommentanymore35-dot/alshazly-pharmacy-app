import { eq, desc, sql, and, like, or } from "drizzle-orm";
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
  return db.select().from(medicines).where(eq(medicines.isActive, true)).orderBy(desc(medicines.createdAt));
}

export async function getAllMedicines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicines).orderBy(desc(medicines.createdAt));
}

export async function getMedicinesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(medicines).where(and(eq(medicines.categoryId, categoryId), eq(medicines.isActive, true)));
}

export async function searchMedicines(query: string) {
  const db = await getDb();
  if (!db) return [];
  const searchTerm = `%${query}%`;
  return db.select().from(medicines).where(
    and(
      eq(medicines.isActive, true),
      or(like(medicines.nameAr, searchTerm), like(medicines.nameEn, searchTerm))
    )
  );
}

export async function getMedicineById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(medicines).where(eq(medicines.id, id)).limit(1);
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
  await db.update(medicines).set({ isActive: false }).where(eq(medicines.id, id));
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
  await db.update(customers).set(data).where(eq(customers.deviceId, deviceId));
}

export async function getCustomerByDeviceId(deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.deviceId, deviceId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ===== ORDER FUNCTIONS =====
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
  const db = await getDb();
  if (!db) return false;
  const result = await db.select().from(adminCredentials).where(
    and(eq(adminCredentials.username, username), eq(adminCredentials.password, password))
  ).limit(1);
  return result.length > 0;
}

export async function createAdminIfNotExists(username: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(adminCredentials).where(eq(adminCredentials.username, username)).limit(1);
  if (existing.length === 0) {
    await db.insert(adminCredentials).values({ username, password });
  }
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
