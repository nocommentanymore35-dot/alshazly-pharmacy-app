export type NotificationPayload = {
  title: string;
  content: string;
};

/**
 * Standalone notification - logs to console instead of Manus service
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  console.log(`[Notification] ${payload.title}: ${payload.content}`);
  return true;
}
