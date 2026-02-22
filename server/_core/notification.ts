export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Simple notification logger - logs to console
 * Can be extended later with email/SMS/push notifications
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  try {
    console.log(`[Notification] ${payload.title}`);
    console.log(`[Notification] ${payload.content}`);
    return true;
  } catch (error) {
    console.warn("[Notification] Error:", error);
    return false;
  }
}
