import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";

export function PushNotificationRegistrar() {
  const [registered, setRegistered] = useState(false);
  const registerMutation = trpc.pushTokens.register.useMutation();
  const { state } = useAppStore();
  const customerId = state.customerId;
  const isAdminLoggedIn = state.isAdminLoggedIn;

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (registered) return;

    let isMounted = true;

    async function setup() {
      try {
        // Dynamic import to avoid module-level crash
        const Notifications = await import("expo-notifications");
        const Constants = await import("expo-constants");

        // Set notification handler
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });

        // Set up Android notification channel
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("orders", {
            name: "الطلبات",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#2196F3",
            sound: "default",
          });
        }

        // Check if physical device
        const isDevice = Constants.default?.isDevice ?? false;
        if (!isDevice) {
          console.log("[Push] Must use physical device");
          return;
        }

        // Check permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("[Push] Permission not granted");
          return;
        }

        // Get push token
        const projectId = Constants.default?.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || undefined,
        });
        const token = tokenData.data;
        console.log("[Push] Token:", token);

        if (token && isMounted) {
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

    // Delay setup to ensure app is fully loaded
    const timer = setTimeout(() => {
      setup();
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [customerId, isAdminLoggedIn]);

  // Re-register when admin logs in
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!isAdminLoggedIn || !registered) return;

    async function reRegister() {
      try {
        const Notifications = await import("expo-notifications");
        const Constants = await import("expo-constants");
        const projectId = Constants.default?.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || undefined,
        });
        if (tokenData.data) {
          registerMutation.mutate({
            token: tokenData.data,
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
  }, [isAdminLoggedIn]);

  return null;
}
