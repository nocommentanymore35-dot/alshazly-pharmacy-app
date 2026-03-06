import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";

// Configure notification handler at module level
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function PushNotificationRegistrar() {
  const [pushToken, setPushToken] = useState<string | null>(null);
  const registerMutation = trpc.pushTokens.register.useMutation();
  const { state } = useAppStore();
  const customerId = state.customerId;
  const deviceId = state.deviceId;
  const isAdminLoggedIn = state.isAdminLoggedIn;
  const retryCount = useRef(0);
  const maxRetries = 3;

  // Build registration payload - only include fields that have values
  function buildPayload(token: string) {
    const payload: { token: string; isAdmin: boolean; deviceId?: string; customerId?: number } = {
      token,
      isAdmin: isAdminLoggedIn || false,
    };
    // Only add deviceId if it's a non-empty string
    if (deviceId && typeof deviceId === 'string' && deviceId.length > 0) {
      payload.deviceId = deviceId;
    }
    // Only add customerId if it's a positive number
    if (customerId && typeof customerId === 'number' && customerId > 0) {
      payload.customerId = customerId;
    }
    return payload;
  }

  // Register for push notifications on mount
  useEffect(() => {
    if (Platform.OS === "web") return;

    async function register() {
      try {
        console.log("[Push] Starting registration... attempt:", retryCount.current + 1);

        // Set up Android notification channel
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("orders", {
            name: "الطلبات",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#2196F3",
            sound: "default",
          });
          console.log("[Push] Android channel created");
        }

        // Check if physical device
        if (!Device.isDevice) {
          console.log("[Push] Not a physical device, skipping");
          return;
        }

        // Check and request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("[Push] Permission denied");
          return;
        }

        // Get push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || "6391fb6e-21f2-4b17-8a4a-bef58f930e77",
        });

        const token = tokenData.data;
        console.log("[Push] Got token:", token);
        setPushToken(token);

        // Register on server - only send fields with actual values
        const payload = buildPayload(token);
        console.log("[Push] Sending payload:", JSON.stringify(payload));
        registerMutation.mutate(payload);

        console.log("[Push] Registration complete");
      } catch (error) {
        console.error("[Push] Registration error:", error);
        retryCount.current += 1;
        if (retryCount.current < maxRetries) {
          console.log("[Push] Will retry in 5 seconds...");
          setTimeout(register, 5000);
        }
      }
    }

    // Small delay to ensure app is ready
    const timer = setTimeout(register, 2000);
    return () => clearTimeout(timer);
  }, [deviceId]);

  // Re-register when admin logs in, customer changes, or token is available
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!pushToken) return;

    console.log("[Push] Re-registering - isAdmin:", isAdminLoggedIn, "customerId:", customerId, "deviceId:", deviceId);
    const payload = buildPayload(pushToken);
    registerMutation.mutate(payload);
  }, [isAdminLoggedIn, customerId, pushToken]);

  // Listen for notifications
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
