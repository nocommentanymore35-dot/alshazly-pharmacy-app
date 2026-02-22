import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import * as db from "./db";

// Daily search limit per device
const DAILY_SEARCH_LIMIT = 50;

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
      .input(z.object({ query: z.string(), deviceId: z.string().optional() }))
      .query(async ({ input }) => {
        // Rate limiting: log search and check daily limit
        if (input.deviceId) {
          const searchCount = await db.getSearchCountToday(input.deviceId);
          if (searchCount >= DAILY_SEARCH_LIMIT) {
            // Notify admin about excessive searching
            try {
              await notifyOwner({
                title: "تنبيه: عمليات بحث مفرطة",
                content: `الجهاز ${input.deviceId} تجاوز حد البحث اليومي (${DAILY_SEARCH_LIMIT} عملية). عدد عمليات البحث اليوم: ${searchCount + 1}`,
              });
            } catch (e) { console.warn("Failed to notify about rate limit:", e); }
            // Still allow search but log the warning
          }
          await db.logSearch(input.deviceId, input.query);
        }
        return db.searchMedicines(input.query);
      }),
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
      .mutation(async ({ input }) => {
        const { deviceId, ...data } = input;
        await db.updateCustomer(deviceId, data);
        // Notify admin about new customer profile submission
        if (data.fullName && data.phone) {
          try {
            await notifyOwner({
              title: "عميل جديد بانتظار الموافقة",
              content: `عميل جديد أضاف بياناته:\nالاسم: ${data.fullName}\nالهاتف: ${data.phone}\nالعنوان: ${data.address || "غير محدد"}\n\nيرجى الموافقة عليه من لوحة الإدارة.`,
            });
          } catch (e) { console.warn("Failed to notify about new customer:", e); }
        }
        return { success: true };
      }),
    get: publicProcedure
      .input(z.object({ deviceId: z.string() }))
      .query(({ input }) => db.getCustomerByDeviceId(input.deviceId)),
    // Admin: list all customers
    listAll: publicProcedure.query(() => db.getAllCustomers()),
    // Admin: approve customer
    approve: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.approveCustomer(input.id)),
    // Admin: reject customer
    reject: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.rejectCustomer(input.id)),
    // Admin: toggle active status
    toggleActive: publicProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(({ input }) => db.toggleCustomerActive(input.id, input.isActive)),
    // Admin: delete customer
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteCustomer(input.id)),
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
    // Top searchers today
    topSearchers: publicProcedure.query(() => db.getTopSearchersToday()),
  }),

  // App Settings
  settings: router({
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => db.getSetting(input.key)),
    set: publicProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(({ input }) => db.setSetting(input.key, input.value)),
    // Loyalty program toggle
    isLoyaltyEnabled: publicProcedure.query(() => db.isLoyaltyEnabled()),
    toggleLoyalty: publicProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(({ input }) => db.setSetting("loyalty_enabled", input.enabled ? "true" : "false")),
  }),

  // Voice Search (Speech-to-Text) - supports both URL and base64
  voice: router({
    transcribe: publicProcedure
      .input(z.object({ audioUrl: z.string().optional(), audioBase64: z.string().optional() }))
      .mutation(async ({ input }) => {
        if (input.audioBase64) {
          const { transcribeAudioFromBase64 } = await import("./_core/voiceTranscription");
          const result = await transcribeAudioFromBase64(input.audioBase64, {
            language: "ar",
            prompt: "بحث عن أدوية صيدلية",
          });
          if ("error" in result) {
            return { text: "", error: (result as any).error };
          }
          return { text: (result as any).text };
        } else if (input.audioUrl) {
          const { transcribeAudio } = await import("./_core/voiceTranscription");
          const result = await transcribeAudio({
            audioUrl: input.audioUrl,
            language: "ar",
            prompt: "بحث عن أدوية صيدلية",
          });
          if ("error" in result) {
            return { text: "", error: (result as any).error };
          }
          return { text: (result as any).text };
        }
        return { text: "", error: "No audio data provided" };
      }),
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
