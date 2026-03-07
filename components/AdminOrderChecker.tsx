import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";
import { useAppStore } from "@/lib/store";
import { getApiBaseUrl } from "@/constants/oauth";

/**
 * AdminOrderChecker - يعمل على مستوى التطبيق الرئيسي
 * يفحص الطلبات الجديدة كل 5 ثواني
 * يرسل إشعار محلي بصوت عالي + اهتزاز قوي عند طلب جديد
 * يعمل في المقدمة والخلفية
 */
export function AdminOrderChecker() {
  const { state } = useAppStore();
  const isAdmin = state.isAdminLoggedIn;
  const lastOrderCountRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const appStateRef = useRef(AppState.currentState);

  // تشغيل صوت تنبيه مزعج ومتكرر
  const playAlarmSound = useCallback(async () => {
    try {
      // إعداد الصوت ليعمل بأقصى مستوى حتى في الوضع الصامت
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      // تشغيل الصوت 5 مرات متتالية ليكون مزعجاً
      for (let i = 0; i < 5; i++) {
        try {
          if (soundRef.current) {
            await soundRef.current.unloadAsync();
          }
          const { sound } = await Audio.Sound.createAsync(
            require("@/assets/sounds/alert.mp3"),
            { volume: 1.0, shouldPlay: true }
          );
          soundRef.current = sound;
          // انتظار 1.5 ثانية بين كل تشغيل
          await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
          console.log("[OrderChecker] Sound play error:", e);
        }
      }
    } catch (error) {
      console.log("[OrderChecker] Audio setup error:", error);
    }
  }, []);

  // إرسال إشعار محلي (يعمل حتى لو التطبيق في الخلفية)
  const sendLocalNotification = useCallback(async (ordersCount: number) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🔔 طلب جديد!",
          body: `تم استلام طلب جديد! يرجى مراجعته الآن. (إجمالي الطلبات: ${ordersCount})`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 1000, 300, 1000, 300, 1000, 300, 1000],
          ...(Platform.OS === "android" ? { channelId: "admin-orders" } : {}),
        },
        trigger: null, // فوري
      });
    } catch (e) {
      console.log("[OrderChecker] Local notification error:", e);
    }
  }, []);

  // إعداد قناة إشعارات Android بصوت عالي جداً
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("admin-orders", {
        name: "تنبيه الطلبات الجديدة",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 1000, 300, 1000, 300, 1000, 300, 1000],
        lightColor: "#FF0000",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
        bypassDnd: true, // تجاوز وضع عدم الإزعاج
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }, []);

  // فحص الطلبات الجديدة
  const checkNewOrders = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/trpc/orders.listAll`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) return;

      const data = await response.json();
      const orders = data?.result?.data?.json || data?.result?.data || [];
      const currentCount = Array.isArray(orders) ? orders.length : 0;

      if (lastOrderCountRef.current !== null && currentCount > lastOrderCountRef.current) {
        const newOrdersCount = currentCount - lastOrderCountRef.current;
        console.log(`[OrderChecker] 🔔 ${newOrdersCount} طلب جديد! المجموع: ${currentCount}`);

        // اهتزاز قوي ومتكرر
        Vibration.vibrate([0, 1000, 300, 1000, 300, 1000, 300, 1000, 300, 1000], false);

        // إشعار محلي (يعمل في الخلفية)
        await sendLocalNotification(currentCount);

        // صوت تنبيه مزعج (يعمل في المقدمة والخلفية)
        playAlarmSound();
      }

      lastOrderCountRef.current = currentCount;
    } catch (error) {
      console.log("[OrderChecker] Check error:", error);
    }
  }, [isAdmin, sendLocalNotification, playAlarmSound]);

  // بدء/إيقاف الفحص الدوري
  useEffect(() => {
    if (!isAdmin) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      lastOrderCountRef.current = null;
      return;
    }

    // فحص فوري عند تسجيل الدخول
    checkNewOrders();

    // فحص كل 5 ثواني
    intervalRef.current = setInterval(checkNewOrders, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAdmin, checkNewOrders]);

  // الاستماع لتغيير حالة التطبيق (مقدمة/خلفية)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isAdmin
      ) {
        // التطبيق رجع للمقدمة - فحص فوري
        console.log("[OrderChecker] App returned to foreground, checking orders...");
        checkNewOrders();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isAdmin, checkNewOrders]);

  // تنظيف الصوت عند إزالة المكون
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  return null;
}
