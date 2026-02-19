import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

// Users table (auth - already exists)
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// Categories table
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Medicines table
export const medicines = mysqlTable("medicines", {
  id: int("id").autoincrement().primaryKey(),
  nameAr: varchar("nameAr", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }).notNull(),
  descriptionAr: text("descriptionAr"),
  descriptionEn: text("descriptionEn"),
  strips: int("strips").default(1).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("imageUrl"),
  categoryId: int("categoryId").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  stock: int("stock").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Banners/Advertisements table
export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Customers table (no password needed)
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 255 }).notNull().unique(),
  fullName: varchar("fullName", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Orders table
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  customerAddress: text("customerAddress").notNull(),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "vodafone_cash"]).notNull(),
  status: mysqlEnum("status", ["received", "preparing", "shipped", "delivered"]).default("received").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// Order Items table
export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  medicineId: int("medicineId").notNull(),
  medicineName: varchar("medicineName", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
});

// Admin credentials table
export const adminCredentials = mysqlTable("admin_credentials", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type Medicine = typeof medicines.$inferSelect;
export type InsertMedicine = typeof medicines.$inferInsert;
export type Banner = typeof banners.$inferSelect;
export type InsertBanner = typeof banners.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;
export type AdminCredential = typeof adminCredentials.$inferSelect;
export type InsertAdminCredential = typeof adminCredentials.$inferInsert;
