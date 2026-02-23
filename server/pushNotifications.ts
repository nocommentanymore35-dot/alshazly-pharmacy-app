// Expo Push Notifications Helper
// Uses Expo's free push notification service

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

export async function sendPushNotifications(tokens: string[], title: string, body: string, data?: Record<string, any>) {
  if (tokens.length === 0) return;

  const messages: ExpoPushMessage[] = tokens
    .filter(token => token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["))
    .map(token => ({
      to: token,
      title,
      body,
      data: data || {},
      sound: "default" as const,
      priority: "high" as const,
      channelId: "orders",
    }));

  if (messages.length === 0) return;

  // Send in chunks of 100 (Expo limit)
  const chunks: ExpoPushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      const result = await response.json();
      console.log("[Push] Sent notifications:", result?.data?.length || 0);
    } catch (error) {
      console.error("[Push] Failed to send notifications:", error);
    }
  }
}

// Send notification to admin (pharmacy owner) when new order is placed
export async function notifyAdminNewOrder(adminTokens: string[], orderId: number, customerName: string, totalAmount: string, paymentMethod: string) {
  const paymentText = paymentMethod === "cash" ? "الدفع عند الاستلام" : "فودافون كاش";
  await sendPushNotifications(
    adminTokens,
    `طلب جديد #${orderId}`,
    `طلب جديد من ${customerName}\nالمبلغ: ${totalAmount} ج.م\nالدفع: ${paymentText}`,
    { type: "new_order", orderId }
  );
}

// Send notification to customer when order status changes
export async function notifyCustomerOrderStatus(customerTokens: string[], orderId: number, status: string) {
  const statusMessages: Record<string, string> = {
    "received": "تم استلام طلبك وجاري مراجعته",
    "preparing": "جاري تحضير طلبك الآن",
    "shipped": "تم شحن طلبك وفي الطريق إليك",
    "delivered": "تم توصيل طلبك بنجاح. شكراً لتعاملك معنا!",
  };

  const message = statusMessages[status] || `حالة طلبك: ${status}`;
  
  await sendPushNotifications(
    customerTokens,
    `تحديث الطلب #${orderId}`,
    message,
    { type: "order_status", orderId, status }
  );
}

// Send notification to admin when new customer registers
export async function notifyAdminNewCustomer(adminTokens: string[], customerName: string, customerPhone: string) {
  await sendPushNotifications(
    adminTokens,
    "عميل جديد بانتظار الموافقة",
    `${customerName} - ${customerPhone}`,
    { type: "new_customer" }
  );
}
