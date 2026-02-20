import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Categories
  categories: router({
    list: publicProcedure.query(() => db.getActiveCategories()),
    listAll: publicProcedure.query(() => db.getCategories()),
    create: publicProcedure
      .input(z.object({ nameAr: z.string(), nameEn: z.string(), sortOrder: z.number().optional() }))
      .mutation(({ input }) => db.createCategory({ ...input, sortOrder: input.sortOrder ?? 0 })),
    update: publicProcedure
      .input(z.object({ id: z.number(), nameAr: z.string().optional(), nameEn: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateCategory(id, data); }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCategory(input.id)),
  }),

  // Medicines
  medicines: router({
    list: publicProcedure.query(() => db.getMedicines()),
    listAll: publicProcedure.query(() => db.getAllMedicines()),
    byCategory: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(({ input }) => db.getMedicinesByCategory(input.categoryId)),
    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => db.searchMedicines(input.query)),
    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getMedicineById(input.id)),
    create: publicProcedure
      .input(z.object({
        nameAr: z.string(), nameEn: z.string(),
        descriptionAr: z.string().optional(), descriptionEn: z.string().optional(),
        price: z.string(), imageUrl: z.string().optional(),
        categoryId: z.number(), stock: z.number().optional(),
        strips: z.number().optional(),
      }))
      .mutation(({ input }) => db.createMedicine({ ...input, stock: input.stock ?? 0, strips: input.strips ?? 1 })),
    update: publicProcedure
      .input(z.object({
        id: z.number(), nameAr: z.string().optional(), nameEn: z.string().optional(),
        descriptionAr: z.string().optional(), descriptionEn: z.string().optional(),
        price: z.string().optional(), imageUrl: z.string().optional(),
        categoryId: z.number().optional(), stock: z.number().optional(),
        strips: z.number().optional(), isActive: z.boolean().optional(),
      }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateMedicine(id, data); }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteMedicine(input.id)),
  }),

  // Banners
  banners: router({
    list: publicProcedure.query(() => db.getActiveBanners()),
    listAll: publicProcedure.query(() => db.getAllBanners()),
    create: publicProcedure
      .input(z.object({ title: z.string().optional(), description: z.string().optional(), imageUrl: z.string(), sortOrder: z.number().optional() }))
      .mutation(({ input }) => db.createBanner({ ...input, sortOrder: input.sortOrder ?? 0 })),
    update: publicProcedure
      .input(z.object({ id: z.number(), title: z.string().optional(), description: z.string().optional(), imageUrl: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
      .mutation(({ input }) => { const { id, ...data } = input; return db.updateBanner(id, data); }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteBanner(input.id)),
  }),

  // Customers
  customers: router({
    getOrCreate: publicProcedure
      .input(z.object({ deviceId: z.string() }))
      .mutation(({ input }) => db.getOrCreateCustomer(input.deviceId)),
    update: publicProcedure
      .input(z.object({ deviceId: z.string(), fullName: z.string().optional(), phone: z.string().optional(), address: z.string().optional() }))
      .mutation(({ input }) => { const { deviceId, ...data } = input; return db.updateCustomer(deviceId, data); }),
    get: publicProcedure
      .input(z.object({ deviceId: z.string() }))
      .query(({ input }) => db.getCustomerByDeviceId(input.deviceId)),
  }),

  // Orders
  orders: router({
    create: publicProcedure
      .input(z.object({
        customerId: z.number(),
        customerName: z.string(),
        customerPhone: z.string(),
        customerAddress: z.string(),
        totalAmount: z.string(),
        paymentMethod: z.enum(["cash", "vodafone_cash"]),
        items: z.array(z.object({
          medicineId: z.number(),
          medicineName: z.string(),
          quantity: z.number(),
          price: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { items, ...orderData } = input;
        const orderId = await db.createOrder(orderData as any, items.map(i => ({ ...i, orderId: 0 })));
        // Notify admin about new order
        try {
          await notifyOwner({
            title: "طلب جديد #" + orderId,
            content: `طلب جديد من ${input.customerName}\nالهاتف: ${input.customerPhone}\nالعنوان: ${input.customerAddress}\nالمبلغ: ${input.totalAmount} ج.م\nطريقة الدفع: ${input.paymentMethod === "cash" ? "الدفع عند الاستلام" : "فودافون كاش"}`,
          });
        } catch (e) { console.warn("Failed to notify owner:", e); }
        return orderId;
      }),
    byCustomer: publicProcedure
      .input(z.object({ customerId: z.number() }))
      .query(({ input }) => db.getOrdersByCustomer(input.customerId)),
    items: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(({ input }) => db.getOrderItems(input.orderId)),
    listAll: publicProcedure.query(() => db.getAllOrders()),
    updateStatus: publicProcedure
      .input(z.object({ id: z.number(), status: z.enum(["received", "preparing", "shipped", "delivered"]) }))
      .mutation(({ input }) => db.updateOrderStatus(input.id, input.status)),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteOrder(input.id)),
  }),

  // Admin Auth
  admin: router({
    login: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(({ input }) => db.verifyAdmin(input.username, input.password)),
    setup: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(({ input }) => db.createAdminIfNotExists(input.username, input.password)),
  }),

  // Reports
  reports: router({
    sales: publicProcedure.query(() => db.getSalesReport()),
    reset: publicProcedure.mutation(() => db.resetSalesReport()),
  }),

  // File Upload
  upload: router({
    image: publicProcedure
      .input(z.object({ base64: z.string(), fileName: z.string(), contentType: z.string() }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const key = `pharmacy/${input.fileName}-${randomSuffix}`;
        const result = await storagePut(key, buffer, input.contentType);
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
