import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import { notifyAdminNewOrder, notifyCustomerOrderStatus, notifyAdminNewCustomer } from "./pushNotifications";
import * as db from "./db";
import { invalidateSearchCache } from "./db";

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
        if (input.deviceId) {
          const searchCount = await db.getSearchCountToday(input.deviceId);
          if (searchCount >= DAILY_SEARCH_LIMIT) {
            try {
              await notifyOwner({
                title: "تنبيه: عمليات بحث مفرطة",
                content: `الجهاز ${input.deviceId} تجاوز حد البحث اليومي (${DAILY_SEARCH_LIMIT} عملية). عدد عمليات البحث اليوم: ${searchCount + 1}`,
              });
            } catch (e) { console.warn("Failed to notify about rate limit:", e); }
          }
          await db.logSearch(input.deviceId, input.query);
        }
        const cleanQuery = input.query
          .replace(/[.,،؟?!؛;:"'()\[\]{}]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return db.searchMedicines(cleanQuery);
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.stock !== undefined && data.stock > 0) {
          const currentMedicine = await db.getMedicineById(id);
          if (currentMedicine && currentMedicine.stock === 0) {
            try {
              const alertTokens = await db.getStockAlertCustomerTokens(id);
              if (alertTokens.length > 0) {
                const { sendPushNotifications } = await import("./pushNotifications");
                await sendPushNotifications(
                  alertTokens,
                  `${currentMedicine.nameAr} أصبح متوفراً!`,
                  `الصنف ${currentMedicine.nameAr} (${currentMedicine.nameEn}) عاد للمخزون. اطلبه الآن!`,
                  { type: "stock_alert", medicineId: id.toString() }
                );
              }
              await db.clearStockAlertsForMedicine(id);
            } catch (e) { console.warn("Failed to send stock alert notifications:", e); }
          }
        }
        const result = await db.updateMedicine(id, data);
        invalidateSearchCache();
        return result;
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => { const result = await db.deleteMedicine(input.id); invalidateSearchCache(); return result; }),
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
      .mutation(async ({ input }) => {
        const customer = await db.getOrCreateCustomer(input.deviceId);
        // Note: Push token will be registered by PushNotificationRegistrar when the real Expo token is obtained
        console.log(`[Push] Customer ${customer.id} created/found for device ${input.deviceId}. Waiting for real push token registration.`);
        return customer;
      }),
    update: publicProcedure
      .input(z.object({ deviceId: z.string(), fullName: z.string().optional(), phone: z.string().optional(), address: z.string().optional() }))
      .mutation(async ({ input }) => {
        const { deviceId, ...data } = input;
        await db.updateCustomer(deviceId, data);
        if (data.fullName && data.phone) {
          try {
            await notifyOwner({
              title: "عميل جديد بانتظار الموافقة",
              content: `عميل جديد أضاف بياناته:\nالاسم: ${data.fullName}\nالهاتف: ${data.phone}\nالعنوان: ${data.address || "غير محدد"}\n\nيرجى الموافقة عليه من لوحة الإدارة.`,
            });
          } catch (e) { console.warn("Failed to notify about new customer:", e); }
          try {
            const adminTokens = await db.getAdminPushTokens();
            await notifyAdminNewCustomer(adminTokens, data.fullName, data.phone);
          } catch (e) { console.warn("Failed to send push to admin:", e); }
        }
        return { success: true };
      }),
    get: publicProcedure
      .input(z.object({ deviceId: z.string() }))
      .query(({ input }) => db.getCustomerByDeviceId(input.deviceId)),
    listAll: publicProcedure.query(() => db.getAllCustomers()),
    approve: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.approveCustomer(input.id)),
    reject: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.rejectCustomer(input.id)),
    toggleActive: publicProcedure
      .input(z.object({ id: z.number(), isActive: z.boolean() }))
      .mutation(({ input }) => db.toggleCustomerActive(input.id, input.isActive)),
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
          unitType: z.enum(["box", "strip"]).default("box"),
          stripsPerBox: z.number().default(1),
        })),
      }))
      .mutation(async ({ input }) => {
        const { items, ...orderData } = input;
        const stockCheck = await db.validateOrderStock(items);
        if (!stockCheck.valid) {
          throw new Error(stockCheck.errors.join('\n'));
        }
        const orderId = await db.createOrder(orderData, items.map(i => ({ ...i, orderId: 0 })));
        try {
          // خصم المخزون بالشرائط: شريط=خصم الكمية مباشرة، علبة=خصم الكمية × عدد الشرائط بالعلبة
          const stockDeductions = items.map(i => {
            let stripQuantity = i.quantity;
            if (i.unitType === "box" && i.stripsPerBox > 0) {
              stripQuantity = i.quantity * i.stripsPerBox;
            }
            return { medicineId: i.medicineId, quantity: stripQuantity };
          });
          await db.deductStock(stockDeductions);
        } catch (e) { console.warn("Failed to deduct stock:", e); }
        try {
          await notifyOwner({
            title: "طلب جديد #" + orderId,
            content: `طلب جديد من ${input.customerName}\nالهاتف: ${input.customerPhone}\nالعنوان: ${input.customerAddress}\nالمبلغ: ${input.totalAmount} ج.م\nطريقة الدفع: ${input.paymentMethod === "cash" ? "الدفع عند الاستلام" : "فودافون كاش"}`,
          });
        } catch (e) { console.warn("Failed to notify owner:", e); }
        try {
          const adminTokens = await db.getAdminPushTokens();
          await notifyAdminNewOrder(adminTokens, orderId, input.customerName, input.totalAmount, input.paymentMethod);
        } catch (e) { console.warn("Failed to send push to admin:", e); }
        try {
          const lowStockItems = await db.getLowStockMedicines(5);
          if (lowStockItems.length > 0) {
            const lowStockNames = lowStockItems.slice(0, 5).map(m => `${m.nameAr} (${m.stock})`).join('\n');
            await notifyOwner({
              title: `تنبيه: ${lowStockItems.length} صنف بمخزون منخفض`,
              content: `الأصناف التالية مخزونها منخفض:\n${lowStockNames}`,
            });
          }
        } catch (e) { console.warn("Failed to check low stock:", e); }
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
      .input(z.object({ id: z.number(), status: z.enum(["received", "preparing", "shipped", "delivered"]), customerId: z.number().optional() }))
      .mutation(async ({ input }) => {
        await db.updateOrderStatus(input.id, input.status);
        if (input.customerId) {
          try {
            const customerTokens = await db.getCustomerPushTokens(input.customerId);
            await notifyCustomerOrderStatus(customerTokens, input.id, input.status);
          } catch (e) { console.warn("Failed to send push to customer:", e); }
        }
        return { success: true };
      }),
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
    changePassword: publicProcedure
      .input(z.object({ username: z.string(), currentPassword: z.string(), newPassword: z.string() }))
      .mutation(async ({ input }) => {
        const success = await db.changeAdminPassword(input.username, input.currentPassword, input.newPassword);
        if (!success) throw new Error("كلمة المرور الحالية غير صحيحة");
        return { success: true };
      }),
  }),

  // Reports
  reports: router({
    sales: publicProcedure.query(() => db.getSalesReport()),
    reset: publicProcedure.mutation(() => db.resetSalesReport()),
    topSearchers: publicProcedure.query(() => db.getTopSearchersToday()),
    mostOrdered: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(({ input }) => db.getMostOrderedMedicines(input?.limit ?? 10)),
    lowStock: publicProcedure
      .input(z.object({ threshold: z.number().optional() }).optional())
      .query(({ input }) => db.getLowStockMedicines(input?.threshold ?? 5)),
    daily: publicProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(({ input }) => {
        const date = input?.date ? new Date(input.date) : undefined;
        return db.getDailyOrdersReport(date);
      }),
    advancedStats: publicProcedure.query(() => db.getAdvancedStats()),
  }),

  // App Settings
  settings: router({
    get: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => db.getSetting(input.key)),
    set: publicProcedure
      .input(z.object({ key: z.string(), value: z.string() }))
      .mutation(({ input }) => db.setSetting(input.key, input.value)),
    isLoyaltyEnabled: publicProcedure.query(() => db.isLoyaltyEnabled()),
    toggleLoyalty: publicProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(({ input }) => db.setSetting("loyalty_enabled", input.enabled ? "true" : "false")),
  }),

  // Voice Search
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
            return { text: "", error: result.error };
          }
          return { text: result.text };
        } else if (input.audioUrl) {
          const { transcribeAudio } = await import("./_core/voiceTranscription");
          const result = await transcribeAudio({
            audioUrl: input.audioUrl,
            language: "ar",
            prompt: "بحث عن أدوية صيدلية",
          });
          if ("error" in result) {
            return { text: "", error: result.error };
          }
          return { text: result.text };
        }
        return { text: "", error: "No audio data provided" };
      }),
  }),

  // Push Notifications
  pushTokens: router({
    register: publicProcedure
      .input(z.object({ token: z.string(), deviceId: z.string().nullish(), customerId: z.number().nullish(), isAdmin: z.boolean().optional() }))
      .mutation(({ input }) => db.registerPushToken(input.token, input.deviceId ?? undefined, input.customerId ?? undefined, input.isAdmin ?? false)),
    remove: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => db.removePushToken(input.token)),
    count: publicProcedure.query(() => db.getPushTokenCount()),
    debug: publicProcedure.query(async () => {
      const all = await db.getAllPushTokens();
      const real = all.filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));
      const fallback = all.filter(t => !t.startsWith('ExponentPushToken[') && !t.startsWith('ExpoPushToken['));
      return { total: all.length, realTokens: real.length, fallbackTokens: fallback.length, tokens: all.map(t => t.substring(0, 40) + (t.length > 40 ? '...' : '')) };
    }),
    cleanup: publicProcedure.mutation(async () => {
      const cleaned = await db.cleanupFallbackTokens();
      return { success: true, cleaned, message: `تم تنظيف ${cleaned} توكن وهمي من قاعدة البيانات` };
    }),
    sendBroadcast: publicProcedure
      .input(z.object({
        title: z.string().min(1, "عنوان الإشعار مطلوب"),
        body: z.string().min(1, "محتوى الإشعار مطلوب"),
        target: z.enum(["all", "customers", "admin"]).default("all"),
      }))
      .mutation(async ({ input }) => {
        const { sendPushNotifications } = await import("./pushNotifications");
        let tokens = [];
        if (input.target === "all") {
          tokens = await db.getAllPushTokens();
        } else if (input.target === "customers") {
          tokens = await db.getCustomerOnlyPushTokens();
        } else if (input.target === "admin") {
          tokens = await db.getAdminPushTokens();
        }
        if (tokens.length === 0) {
          return { success: false, sent: 0, message: "لا يوجد أجهزة مسجلة لاستقبال الإشعارات" };
        }
        const result = await sendPushNotifications(tokens, input.title, input.body, { type: "broadcast" });
        if (result.validTokens === 0) {
          return { success: false, sent: 0, message: `يوجد ${result.totalTokens} جهاز مسجل لكن لا يوجد منها توكنات صالحة. يجب أن يفتح العميل التطبيق ويوافق على إذن الإشعارات.` };
        }
        const errorInfo = result.errors.length > 0 ? `\n(${result.errors.length} أخطاء)` : "";
        return { success: true, sent: result.sentCount, message: `تم إرسال الإشعار إلى ${result.sentCount} جهاز من أصل ${result.totalTokens}${errorInfo}` };
      }),
  }),

  // Stock Alerts
  stockAlerts: router({
    register: publicProcedure
      .input(z.object({ customerId: z.number(), medicineId: z.number(), deviceId: z.string().optional() }))
      .mutation(async ({ input }) => {
        const result = await db.registerStockAlert(input.customerId, input.medicineId, input.deviceId);
        if (result.alreadyRegistered) {
          return { success: true, message: "أنت مسجل بالفعل لاستقبال إشعار عند توفر هذا الصنف" };
        }
        return { success: true, message: "سيتم إعلامك عند توفر هذا الصنف" };
      }),
    remove: publicProcedure
      .input(z.object({ customerId: z.number(), medicineId: z.number() }))
      .mutation(async ({ input }) => {
        await db.removeStockAlert(input.customerId, input.medicineId);
        return { success: true };
      }),
    check: publicProcedure
      .input(z.object({ customerId: z.number(), medicineId: z.number() }))
      .query(({ input }) => db.hasStockAlert(input.customerId, input.medicineId)),
    count: publicProcedure
      .input(z.object({ medicineId: z.number() }))
      .query(({ input }) => db.getStockAlertCount(input.medicineId)),
    listAll: publicProcedure
      .query(() => db.getAllStockAlertsWithDetails()),
  }),

  // Database Backup
  backup: router({
    create: publicProcedure.mutation(async () => {
      const { performAutoBackup } = await import("./backup");
      const result = await performAutoBackup();
      if (!result.success) throw new Error(result.error || "فشل إنشاء النسخة الاحتياطية");
      return { success: true, url: result.url, message: "تم إنشاء النسخة الاحتياطية بنجاح" };
    }),
    list: publicProcedure.query(async () => {
      const { listBackups } = await import("./backup");
      return listBackups();
    }),
    export: publicProcedure.query(async () => {
      const { exportAllData } = await import("./backup");
      const data = await exportAllData();
      const totalRecords = Object.values(data.tables).reduce((sum, arr) => sum + arr.length, 0);
      return {
        data,
        summary: {
          timestamp: data.timestamp,
          totalRecords,
          tables: Object.entries(data.tables).map(([name, rows]) => ({ name, count: rows.length })),
        },
      };
    }),
    restore: publicProcedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input }) => {
        const { downloadBackup, restoreFromBackup } = await import("./backup");
        const data = await downloadBackup(input.url);
        const result = await restoreFromBackup(data);
        return {
          success: true,
          restored: result.restored,
          errors: result.errors,
          message: result.errors.length > 0
            ? `تم استعادة البيانات مع ${result.errors.length} أخطاء`
            : "تم استعادة جميع البيانات بنجاح",
        };
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
