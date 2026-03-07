import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useAppStore } from "@/lib/store";
import { getApiBaseUrl } from "@/constants/oauth";

// Configure notification handler at module level
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Registers push notification token with the server.
 * Uses direct fetch() instead of tRPC to avoid any serialization issues.
 * NEVER registers fallback/fake tokens - only real Expo Push Tokens.
 * Retries on every app open until a real token is registered.
 */
export function PushNotificationRegistrar() {
  const { state } = useAppStore();
  const deviceId = state.deviceId;
  const customerId = state.customerId;
  const isAdminLoggedIn = state.isAdminLoggedIn;
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Setup Android notification channels
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        lightColor: "#FF0000",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
      Notifications.setNotificationChannelAsync("orders", {
        name: "الطلبات",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 200, 1000, 200, 1000],
        lightColor: "#FF0000",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }
  }, []);

  // Register push token - tries EVERY time the app opens (no hasRegistered flag)
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!deviceId) return; // Wait until deviceId is set

    async function registerPushToken() {
      let token: string | null = null;
      let attempt = 0;
      const maxAttempts = 5;

      while (attempt < maxAttempts && !token) {
        attempt++;
        console.log(`[Push] Attempt ${attempt}/${maxAttempts} to get push token...`);

        try {
          if (Device.isDevice) {
            // Check permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== "granted") {
              const { status } = await Notifications.requestPermissionsAsync();
              finalStatus = status;
            }

            if (finalStatus === "granted") {
              try {
                const projectId = Constants.expoConfig?.extra?.eas?.projectId || "6391fb6e-21f2-4b17-8a4a-bef58f930e77";
                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
                token = tokenData.data;
                console.log("[Push] Got Expo push token:", token);
              } catch (expoErr: any) {
                console.warn("[Push] Expo token failed:", expoErr?.message);
                // Try native token as last resort
                try {
                  const deviceToken = await Notifications.getDevicePushTokenAsync();
                  // Native tokens don't work with Expo Push API, skip them
                  console.warn("[Push] Got native token but it won't work with Expo Push API");
                } catch (nativeErr: any) {
                  console.warn("[Push] Native token also failed:", nativeErr?.message);
                }
              }
            } else {
              console.log("[Push] Permission not granted, status:", finalStatus);
              // Request permissions again with explanation
              console.log("[Push] Will retry on next app open");
            }
          } else {
            console.log("[Push] Not a physical device - skipping push registration");
            return; // Don't retry on emulator
          }
        } catch (err: any) {
          console.warn(`[Push] Attempt ${attempt} error:`, err?.message);
        }

        // If still no token, wait before retrying
        if (!token && attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
        }
      }

      // IMPORTANT: Only register REAL tokens, never fallback tokens
      if (!token) {
        console.warn("[Push] Could not get a real push token after all attempts. Will retry on next app open.");
        return; // Don't register anything - will try again next time
      }

      // Verify it's a real Expo token
      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        console.warn("[Push] Token is not a valid Expo push token, skipping:", token.substring(0, 30));
        return;
      }

      // Send real token to server
      await sendTokenToServer(token);
    }

    async function sendTokenToServer(token: string) {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/trpc/pushTokens.register`;

      const payload: Record<string, any> = {
        token,
        isAdmin: isAdminLoggedIn || false,
      };
      if (deviceId) payload.deviceId = deviceId;
      if (customerId && customerId > 0) payload.customerId = customerId;

      console.log("[Push] Sending REAL token to server:", token.substring(0, 30) + "...");

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: payload }),
          });

          if (response.ok) {
            console.log("[Push] \u2705 Real token registered successfully!");
            return;
          } else {
            const errorText = await response.text();
            console.warn(`[Push] Server returned ${response.status}:`, errorText);
          }
        } catch (fetchErr: any) {
          console.warn(`[Push] Fetch attempt ${attempt} failed:`, fetchErr?.message);
        }

        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }

      console.error("[Push] \u274c All attempts to register token failed");
    }

    // Start registration after a short delay to let the app initialize
    const timer = setTimeout(registerPushToken, 2000);
    return () => clearTimeout(timer);
  }, [deviceId]);

  // Re-register when customerId changes (after profile save)
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!deviceId) return;
    if (!customerId || customerId <= 0) return;

    async function updateRegistration() {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/trpc/pushTokens.register`;

      // Only re-register with a REAL token
      let token: string | null = null;
      try {
        if (Device.isDevice) {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId || "6391fb6e-21f2-4b17-8a4a-bef58f930e77";
          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          token = tokenData.data;
        }
      } catch {
        console.warn("[Push] Could not get token for re-registration");
        return; // Don't re-register without a real token
      }

      if (!token || (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken['))) {
        console.warn("[Push] No valid token for re-registration, skipping");
        return;
      }

      const payload: Record<string, any> = {
        token,
        isAdmin: isAdminLoggedIn || false,
        deviceId,
        customerId,
      };

      console.log("[Push] Re-registering with customerId:", customerId);

      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: payload }),
        });
        console.log("[Push] \u2705 Re-registration successful");
      } catch (err: any) {
        console.warn("[Push] Re-registration failed:", err?.message);
      }
    }

    const timer = setTimeout(updateRegistration, 1000);
    return () => clearTimeout(timer);
  }, [customerId, isAdminLoggedIn]);

  // Listen for incoming notifications
  useEffect(() => {
    if (Platform.OS === "web") return;

    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log("[Push] Notification received:", notification.request.content.title);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("[Push] Notification tapped:", response.notification.request.content.data);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  return null;
}
