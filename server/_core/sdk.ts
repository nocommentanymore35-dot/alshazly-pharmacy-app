// Standalone SDK - replaces Manus OAuth SDK
// All authentication is now handled by oauth.ts directly
import { authenticateRequest } from "./oauth";

export const sdk = {
  authenticateRequest,
};
