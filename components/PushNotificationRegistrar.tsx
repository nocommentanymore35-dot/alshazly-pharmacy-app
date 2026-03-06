import { useEffect, useRef, useState } from "react";
import { Platform, Alert } from "react-native";
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
  const [registered, setRegistered] = useState(false);
  const registerMutation = trpc.pushTokens.register.useMutation({
    onSuccess: () => {
      console.log("[Push] ✅ Token registered on server successfully");
      setRegistered(true);
    },
    onError: (error: any) => {
      console.error("[Push] ❌ Server registration failed:", error?.message || error);
    },
  });
  const { state } = useAppStore();
  const customerId = state.customerId;
  const deviceId = state.deviceId;
  const isAdminLoggedIn = state.isAdminLoggedIn;
  const retryCount = useRef(0);
  const maxRetries = 5;
  const hasStarted = useRef(false);

  // Register for push notifications on mount
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function register() {
      try {
        console.log("[Push] Starting registration... attempt:", retryCount.current + 1);

        // Set up Android notification channel
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#2196F3",
            sound: "default",
          });
          await Notifications.setNotificationChannelAsync("orders", {
            name: "الطلبات",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#2196F3",
            sound: "default",
          });
          console.log("[Push] Android channels created");
        }

        // Check if physical device
        if (!Device.isDevice) {
          console.log("[Push] Not a physical device - registering with fallback token");
          // Even on emulator, try to register with a device-based token
          const fallbackToken = `device_${deviceId || 'unknown'}_${Date.now()}`;
          sendTokenToServer(fallbackToken);
          return;
        }

        // Check and request permissions
        console.log("[Push] Checking permissions...");
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        console.log("[Push] Existing permission status:", existingStatus);
        
        let finalStatus = existingStatus;
        if (existingStatus !== "granted") {
          console.log("[Push] Requesting permissions...");
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
          console.log("[Push] New permission status:", finalStatus);
        }

        if (finalStatus !== "granted") {
          console.log("[Push] Permission denied - registering with device token as fallback");
          // Register with a device-based token so admin can at least see the device
          const fallbackToken = `device_noperm_${deviceId || 'unknown'}_${Date.now()}`;
          sendTokenToServer(fallbackToken);
          return;
        }

        // Get push token
        console.log("[Push] Getting Expo push token...");
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        console.log("[Push] Project ID:", projectId);
        
        try {
          const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: projectId || "6391fb6e-21f2-4b17-8a4a-bef58f930e77",
          });
          const token = tokenData.data;
          console.log("[Push] ✅ Got Expo push token:", token);
          setPushToken(token);
          sendTokenToServer(token);
        } catch (tokenError: any) {
          console.error("[Push] ❌ Failed to get Expo push token:", tokenError?.message || tokenError);
          // Fallback: try getting device push token directly
          try {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            const token = `native_${deviceToken.data}`;
            console.log("[Push] Got native device token:", token);
            setPushToken(token);
            sendTokenToServer(token);
          } catch (deviceTokenError: any) {
            console.error("[Push] ❌ Failed to get device token too:", deviceTokenError?.message);
            // Last resort: register with device ID
            const fallbackToken = `fallback_${deviceId || 'unknown'}_${Date.now()}`;
            console.log("[Push] Using fallback token:", fallbackToken);
            sendTokenToServer(fallbackToken);
          }
        }
      } catch (error: any) {
        console.error("[Push] Registration error:", error?.message || error);
        retryCount.current += 1;
        if (retryCount.current < maxRetries) {
          const delay = retryCount.current * 3000; // Increasing delay
          console.log(`[Push] Will retry in ${delay / 1000} seconds...`);
          setTimeout(register, delay);
        }
      }
    }

    function sendTokenToServer(token: string) {
      const payload: Record<string, any> = {
        token,
        isAdmin: isAdminLoggedIn || false,
      };
      
      // Only add optional fields if they have real values
      if (deviceId && typeof deviceId === 'string' && deviceId.trim().length > 0) {
        payload.deviceId = deviceId;
      }
      if (customerId && typeof customerId === 'number' && customerId > 0) {
        payload.customerId = customerId;
      }
      
      console.log("[Push] Sending to server:", JSON.stringify(payload));
      registerMutation.mutate(payload as any);
    }

    // Start after a short delay
    const timer = setTimeout(register, 3000);
    return () => clearTimeout(timer);
  }, []);

  // Re-register when customerId or admin status changes
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!pushToken) return;
    if (!registered) return; // Don't re-register if initial registration hasn't succeeded

    console.log("[Push] Re-registering with updated info - customerId:", customerId, "isAdmin:", isAdminLoggedIn);
    
    const payload: Record<string, any> = {
      token: pushToken,
      isAdmin: isAdminLoggedIn || false,
    };
    
    if (deviceId && typeof deviceId === 'string' && deviceId.trim().length > 0) {
      payload.deviceId = deviceId;
    }
    if (customerId && typeof customerId === 'number' && customerId > 0) {
      payload.customerId = customerId;
    }
    
    registerMutation.mutate(payload as any);
  }, [isAdminLoggedIn, customerId]);

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
