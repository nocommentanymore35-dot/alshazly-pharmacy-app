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

interface SendResult {
  totalTokens: number;
  validTokens: number;
  invalidTokens: number;
  sentCount: number;
  errors: string[];
}

export async function sendPushNotifications(tokens: string[], title: string, body: string, data?: Record<string, any>): Promise<SendResult> {
  const result: SendResult = {
    totalTokens: tokens.length,
    validTokens: 0,
    invalidTokens: 0,
    sentCount: 0,
    errors: [],
  };

  if (tokens.length === 0) {
    console.log("[Push] No tokens provided");
    return result;
  }

  const validTokens = tokens.filter(token => token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
  const invalidTokens = tokens.filter(token => !token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken["));

  result.validTokens = validTokens.length;
  result.invalidTokens = invalidTokens.length;

  console.log(`[Push] Total tokens: ${tokens.length}, Valid: ${validTokens.length}, Invalid: ${invalidTokens.length}`);

  if (invalidTokens.length > 0) {
    console.log("[Push] Invalid tokens (first 5):", invalidTokens.slice(0, 5).map(t => t.substring(0, 30)));
  }

  const messages: ExpoPushMessage[] = validTokens.map(token => ({
    to: token,
    title,
    body,
    data: data || {},
    sound: "default" as const,
    priority: "high" as const,
    channelId: "orders",
  }));

  if (messages.length === 0) {
    console.log("[Push] No valid tokens to send to");
    result.errors.push("\u0644\u0627 \u064a\u0648\u062c\u062f \u0623\u062c\u0647\u0632\u0629 \u0645\u0633\u062c\u0644\u0629 \u0628\u062a\u0648\u0643\u0646 \u0635\u0627\u0644\u062d. \u064a\u062c\u0628 \u0623\u0646 \u064a\u0641\u062a\u062d \u0627\u0644\u0639\u0645\u064a\u0644 \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0648\u064a\u0648\u0627\u0641\u0642 \u0639\u0644\u0649 \u0625\u0630\u0646 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a.");
    return result;
  }

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
      const responseData = await response.json();

      if (responseData?.data) {
        const successCount = responseData.data.filter((d: any) => d.status === "ok").length;
        const errorCount = responseData.data.filter((d: any) => d.status === "error").length;
        result.sentCount += successCount;

        console.log(`[Push] Chunk sent: ${successCount} ok, ${errorCount} errors`);

        responseData.data.forEach((d: any, i: number) => {
          if (d.status === "error") {
            console.error(`[Push] Error for token ${i}: ${d.message} (${d.details?.error})`);
            result.errors.push(d.message || d.details?.error || "\u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0641");
          }
        });
      } else {
        console.log("[Push] Sent chunk, response:", JSON.stringify(responseData).substring(0, 200));
        result.sentCount += chunk.length;
      }
    } catch (error: any) {
      console.error("[Push] Failed to send notifications:", error?.message || error);
      result.errors.push(error?.message || "\u0641\u0634\u0644 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u062e\u0627\u062f\u0645 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a");
    }
  }

  console.log(`[Push] Final result: sent ${result.sentCount}/${result.validTokens} notifications`);
  return result;
}

export async function notifyAdminNewOrder(adminTokens: string[], orderId: number, customerName: string, totalAmount: string, paymentMethod: string) {
  const paymentText = paymentMethod === "cash" ? "\u0627\u0644\u062f\u0641\u0639 \u0639\u0646\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645" : "\u0641\u0648\u062f\u0627\u0641\u0648\u0646 \u0643\u0627\u0634";
  await sendPushNotifications(
    adminTokens,
    `\u0637\u0644\u0628 \u062c\u062f\u064a\u062f #${orderId}`,
    `\u0637\u0644\u0628 \u062c\u062f\u064a\u062f \u0645\u0646 ${customerName}\n\u0627\u0644\u0645\u0628\u0644\u063a: ${totalAmount} \u062c.\u0645\n\u0627\u0644\u062f\u0641\u0639: ${paymentText}`,
    { type: "new_order", orderId }
  );
}

export async function notifyCustomerOrderStatus(customerTokens: string[], orderId: number, status: string) {
  const statusMessages: Record<string, string> = {
    "received": "\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 \u0648\u062c\u0627\u0631\u064a \u0645\u0631\u0627\u062c\u0639\u062a\u0647",
    "preparing": "\u062c\u0627\u0631\u064a \u062a\u062d\u0636\u064a\u0631 \u0637\u0644\u0628\u0643 \u0627\u0644\u0622\u0646",
    "shipped": "\u062a\u0645 \u0634\u062d\u0646 \u0637\u0644\u0628\u0643 \u0648\u0641\u064a \u0627\u0644\u0637\u0631\u064a\u0642 \u0625\u0644\u064a\u0643",
    "delivered": "\u062a\u0645 \u062a\u0648\u0635\u064a\u0644 \u0637\u0644\u0628\u0643 \u0628\u0646\u062c\u0627\u062d. \u0634\u0643\u0631\u0627\u064b \u0644\u062a\u0639\u0627\u0645\u0644\u0643 \u0645\u0639\u0646\u0627!",
  };

  const message = statusMessages[status] || `\u062d\u0627\u0644\u0629 \u0637\u0644\u0628\u0643: ${status}`;

  await sendPushNotifications(
    customerTokens,
    `\u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0637\u0644\u0628 #${orderId}`,
    message,
    { type: "order_status", orderId, status }
  );
}

export async function notifyAdminNewCustomer(adminTokens: string[], customerName: string, customerPhone: string) {
  await sendPushNotifications(
    adminTokens,
    "\u0639\u0645\u064a\u0644 \u062c\u062f\u064a\u062f \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
    `${customerName} - ${customerPhone}`,
    { type: "new_customer" }
  );
}
