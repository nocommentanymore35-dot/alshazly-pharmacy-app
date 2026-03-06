import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";

// Configure notification handler at module level - safe for native builds
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
        console.log("[Push] Existing permission status:", existingStatus);

        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          console.log("[Push] Requesting permission...");
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log("[Push] New permission status:", finalStatus);
        }

        if (finalStatus !== "granted") {
          console.log("[Push] Permission denied");
          return;
        }

        // Get push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        console.log("[Push] Project ID:", projectId);

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || "6391fb6e-21f2-4b17-8a4a-bef58f930e77",
        });

        const token = tokenData.data;
        console.log("[Push] Got token:", token);
        setPushToken(token);

        // Register on server with all available info
        registerMutation.mutate({
          token,
          deviceId: deviceId ? deviceId : undefined,
          customerId: customerId ? customerId : undefined,
          isAdmin: isAdminLoggedIn || false,
        });

        console.log("[Push] Registration complete - customerId:", customerId, "deviceId:", deviceId);
      } catch (error) {
        console.error("[Push] Registration error:", error);
        // Retry after delay
        retryCount.current += 1;
        if (retryCount.current < maxRetries) {
          console.log("[Push] Will retry in 5 seconds...");
          setTimeout(register, 5000);
        }
      }
    }

    // Small delay to ensure app is ready and customerId/deviceId are loaded
    const timer = setTimeout(register, 2000);
    return () => clearTimeout(timer);
  }, [deviceId]);

  // Re-register when admin logs in, customer changes, or token is available
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!pushToken) return;

    console.log("[Push] Re-registering - isAdmin:", isAdminLoggedIn, "customerId:", customerId, "deviceId:", deviceId);

    registerMutation.mutate({
      token: pushToken,
      deviceId: deviceId ? deviceId : undefined,
      customerId: customerId ? customerId : undefined,
      isAdmin: isAdminLoggedIn || false,
    });
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
