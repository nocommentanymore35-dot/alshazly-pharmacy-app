import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Set up Android notification channel
if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("orders", {
    name: "الطلبات",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#2196F3",
    sound: "default",
  });
}

export function PushNotificationRegistrar() {
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();
  const [registered, setRegistered] = useState(false);

  const registerMutation = trpc.pushTokens.register.useMutation();
  const { state } = useAppStore();
  const customerId = state.customerId;
  const isAdminLoggedIn = state.isAdminLoggedIn;

  useEffect(() => {
    if (registered) return;

    async function setup() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          // Register token on server
          registerMutation.mutate({
            token,
            deviceId: undefined,
            customerId: customerId || undefined,
            isAdmin: isAdminLoggedIn || false,
          });
          setRegistered(true);
        }
      } catch (e) {
        console.warn("[Push] Setup error:", e);
      }
    }

    setup();

    // Listen for incoming notifications
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("[Push] Notification received:", notification.request.content.title);
    });

    // Listen for notification taps
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log("[Push] Notification tapped:", data);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [customerId, isAdminLoggedIn]);

  // Re-register when admin logs in (to mark token as admin)
  useEffect(() => {
    if (isAdminLoggedIn && registered) {
      async function reRegister() {
        try {
          const token = await getExistingPushToken();
          if (token) {
            registerMutation.mutate({
              token,
              deviceId: undefined,
              customerId: customerId || undefined,
              isAdmin: true,
            });
          }
        } catch (e) {
          console.warn("[Push] Re-register error:", e);
        }
      }
      reRegister();
    }
  }, [isAdminLoggedIn]);

  return null; // This component doesn't render anything
}

async function getExistingPushToken(): Promise<string | undefined> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return tokenData.data;
  } catch {
    return undefined;
  }
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined;

  const isDevice = Constants.isDevice;
  if (!isDevice) {
    console.log("[Push] Must use physical device for Push Notifications");
    return undefined;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission not granted for push notifications");
    return undefined;
  }

  // Get the Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    console.log("[Push] Token:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("[Push] Error getting push token:", error);
    return undefined;
  }
}
