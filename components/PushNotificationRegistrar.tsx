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
 * Has multiple fallback mechanisms for token acquisition.
 */
export function PushNotificationRegistrar() {
  const { state } = useAppStore();
  const deviceId = state.deviceId;
  const customerId = state.customerId;
  const isAdminLoggedIn = state.isAdminLoggedIn;
  const hasRegistered = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Setup Android notification channels
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2196F3",
        sound: "default",
      });
      Notifications.setNotificationChannelAsync("orders", {
        name: "الطلبات",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2196F3",
        sound: "default",
      });
    }
  }, []);

  // Register push token - waits for deviceId to be available
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!deviceId) return; // Wait until deviceId is set
    if (hasRegistered.current) return;

    hasRegistered.current = true;

    async function registerPushToken() {
      let token: string | null = null;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts && !token) {
        attempt++;
        console.log(`[Push] Attempt ${attempt}/${maxAttempts} to get push token...`);

        try {
          // Step 1: Try to get Expo Push Token
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
                // Try native token
                try {
                  const deviceToken = await Notifications.getDevicePushTokenAsync();
                  token = `native_${deviceToken.data}`;
                  console.log("[Push] Got native token:", token);
                } catch (nativeErr: any) {
                  console.warn("[Push] Native token failed:", nativeErr?.message);
                }
              }
            } else {
              console.log("[Push] Permission not granted, status:", finalStatus);
            }
          } else {
            console.log("[Push] Not a physical device");
          }
        } catch (err: any) {
          console.warn(`[Push] Attempt ${attempt} error:`, err?.message);
        }

        // If still no token, wait before retrying
        if (!token && attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
      }

      // Use fallback token if all attempts failed
      if (!token) {
        token = `device_${deviceId}_${Date.now()}`;
        console.log("[Push] Using fallback device token:", token);
      }

      // Send token to server using direct fetch (more reliable than tRPC)
      await sendTokenToServer(token);
    }

    async function sendTokenToServer(token: string) {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/trpc/pushTokens.register`;

      // Build payload - only include fields with real values
      const payload: Record<string, any> = {
        token,
        isAdmin: isAdminLoggedIn || false,
      };
      if (deviceId) payload.deviceId = deviceId;
      if (customerId && customerId > 0) payload.customerId = customerId;

      console.log("[Push] Sending token to server:", url, JSON.stringify(payload));

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: payload }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log("[Push] \u2705 Token registered successfully on attempt", attempt);
            return;
          } else {
            const errorText = await response.text();
            console.warn(`[Push] Server returned ${response.status}:`, errorText);
          }
        } catch (fetchErr: any) {
          console.warn(`[Push] Fetch attempt ${attempt} failed:`, fetchErr?.message);
        }

        // Wait before retry
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
    if (!hasRegistered.current) return;

    // Update the server with the new customerId
    async function updateRegistration() {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/trpc/pushTokens.register`;

      // We need a token - try to get the current one or use fallback
      let token: string;
      try {
        if (Device.isDevice) {
          const projectId = Constants.expoConfig?.extra?.eas?.projectId || "6391fb6e-21f2-4b17-8a4a-bef58f930e77";
          const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
          token = tokenData.data;
        } else {
          token = `device_${deviceId}_reregister`;
        }
      } catch {
        token = `device_${deviceId}_reregister`;
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
