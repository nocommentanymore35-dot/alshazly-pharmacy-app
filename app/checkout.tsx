import { useState } from "react";
import { Text, View, ScrollView, Alert, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore, calcItemTotal, getUnitLabel, getPricePerUnit } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ClipboardExpo from "expo-clipboard";

export default function CheckoutScreen() {
  const router = useRouter();
  const { state, clearCart, cartTotal } = useAppStore();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "vodafone_cash">("cash");
  const [submitting, setSubmitting] = useState(false);

  const createOrderMutation = trpc.orders.create.useMutation();

  const handleSubmitOrder = async () => {
    if (state.cart.length === 0) {
      Alert.alert("خطأ", "السلة فارغة");
      return;
    }

    setSubmitting(true);
    try {
      const orderId = await createOrderMutation.mutateAsync({
        customerId: state.customerId!,
        customerName: state.profile.fullName,
        customerPhone: state.profile.phone,
        customerAddress: state.profile.address,
        totalAmount: cartTotal().toFixed(2),
        paymentMethod,
        items: state.cart.map(item => {
          const unitType = item.unitType || "box";
          const stripsPerBox = item.stripsPerBox || 1;
          const unitLabel = unitType === "strip" ? "شريط" : "علبة";
          return {
            medicineId: item.medicineId,
            medicineName: `${item.nameAr} (${item.quantity} ${unitLabel})`,
            quantity: item.quantity,
            price: calcItemTotal(item).toFixed(2),
          };
        }),
      });

      clearCart();
      Alert.alert(
        "تم تأكيد الطلب",
        `تم إرسال طلبك بنجاح! رقم الطلب: #${orderId}\n\nسيتم التواصل معك قريباً.`,
        [{ text: "حسناً", onPress: () => router.replace("/(tabs)/profile" as any) }]
      );
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.");
    }
    setSubmitting(false);
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-white">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-forward" size={24} color="#2563EB" />
          </Pressable>
          <Text style={styles.headerTitle}>إتمام الطلب</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Customer Info Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>بيانات التوصيل</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="person" size={18} color="#6B7280" />
                <Text style={styles.infoText}>{state.profile.fullName}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="phone" size={18} color="#6B7280" />
                <Text style={styles.infoText}>{state.profile.phone}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="location-on" size={18} color="#6B7280" />
                <Text style={styles.infoText}>{state.profile.address}</Text>
              </View>
            </View>
          </View>

          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ملخص الطلب</Text>
            <View style={styles.infoCard}>
              {state.cart.map((item) => {
                const unitType = item.unitType || "box";
                const stripsPerBox = item.stripsPerBox || 1;
                const unitPrice = getPricePerUnit(item.price, stripsPerBox, unitType);
                const itemTotal = calcItemTotal(item);
                const unitLabel = getUnitLabel(unitType, item.quantity);

                return (
                  <View key={item.medicineId} style={styles.orderItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderItemName}>{item.nameAr}</Text>
                      <View style={styles.orderItemMeta}>
                        <View style={styles.orderUnitBadge}>
                          <Text style={styles.orderUnitBadgeText}>{unitLabel}</Text>
                        </View>
                        <Text style={styles.orderItemUnitPrice}>
                          × {unitPrice.toFixed(2)} ج.م
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderItemPrice}>
                      {itemTotal.toFixed(2)} ج.م
                    </Text>
                  </View>
                );
              })}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>الإجمالي</Text>
                <Text style={styles.totalAmount}>{cartTotal().toFixed(2)} ج.م</Text>
              </View>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>طريقة الدفع</Text>

            <Pressable
              onPress={() => setPaymentMethod("cash")}
              style={({ pressed }) => [
                styles.paymentOption,
                paymentMethod === "cash" && styles.paymentOptionActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={[styles.radio, paymentMethod === "cash" && styles.radioActive]}>
                {paymentMethod === "cash" && <View style={styles.radioInner} />}
              </View>
              <MaterialIcons name="payments" size={24} color={paymentMethod === "cash" ? "#2563EB" : "#6B7280"} />
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={[styles.paymentTitle, paymentMethod === "cash" && { color: "#2563EB" }]}>
                  الدفع عند الاستلام
                </Text>
                <Text style={styles.paymentDesc}>ادفع نقداً عند استلام الطلب</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setPaymentMethod("vodafone_cash")}
              style={({ pressed }) => [
                styles.paymentOption,
                paymentMethod === "vodafone_cash" && styles.paymentOptionActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={[styles.radio, paymentMethod === "vodafone_cash" && styles.radioActive]}>
                {paymentMethod === "vodafone_cash" && <View style={styles.radioInner} />}
              </View>
              <MaterialIcons name="phone-android" size={24} color={paymentMethod === "vodafone_cash" ? "#DC2626" : "#6B7280"} />
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={[styles.paymentTitle, paymentMethod === "vodafone_cash" && { color: "#DC2626" }]}>
                  فودافون كاش
                </Text>
                <Text style={styles.paymentDesc}>ادفع عبر محفظة فودافون كاش</Text>
              </View>
            </Pressable>

            {/* Vodafone Cash Details */}
            {paymentMethod === "vodafone_cash" && (
              <View style={styles.vodafoneInfo}>
                <Text style={styles.vodafoneTitle}>رقم الدفع بواسطة فودافون كاش هو :</Text>
                <View style={styles.vodafoneNumberRow}>
                  <Text style={styles.vodafoneNumber}>01095071082</Text>
                  <Pressable
                    onPress={async () => {
                      try {
                        await ClipboardExpo.setStringAsync("01095071082");
                        Alert.alert("تم النسخ", "تم نسخ الرقم بنجاح");
                      } catch {
                        Alert.alert("تم النسخ", "تم نسخ الرقم بنجاح");
                      }
                    }}
                    style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name="content-copy" size={16} color="#2563EB" />
                    <Text style={styles.copyBtnText}>نسخ</Text>
                  </Pressable>
                </View>
                <Text style={styles.vodafoneName}>محمد  ج***  خ****</Text>
                <View style={styles.vodafoneNote}>
                  <MaterialIcons name="info-outline" size={16} color="#F59E0B" />
                  <Text style={styles.vodafoneNoteText}>
                    ملحوظة: قم بنسخ الرقم أولاً{"\n"}ثم بعد ذلك اضغط على زر تأكيد الطلب أسفل الصفحة{"\n"}ثم قم بتحويل المبلغ من محفظتك
                  </Text>
                </View>
                <View style={styles.vodafoneSafe}>
                  <Text style={styles.vodafoneSafeText}>معاملتك آمنة تماماً 🔒</Text>
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleSubmitOrder}
            disabled={submitting}
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={22} color="#fff" />
                <Text style={styles.submitText}>تأكيد الطلب - {cartTotal().toFixed(2)} ج.م</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937" },
  body: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", color: "#1F2937", marginBottom: 12, textAlign: "right" },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: "#374151", flex: 1, textAlign: "right" },
  orderItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  orderItemName: { fontSize: 14, fontWeight: "600", color: "#1F2937", textAlign: "right" },
  orderItemMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  orderUnitBadge: {
    backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, borderWidth: 1, borderColor: "#BFDBFE",
  },
  orderUnitBadgeText: { fontSize: 11, fontWeight: "600", color: "#2563EB" },
  orderItemUnitPrice: { fontSize: 12, color: "#6B7280" },
  orderItemPrice: { fontSize: 14, fontWeight: "bold", color: "#2563EB", marginLeft: 8 },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  totalAmount: { fontSize: 20, fontWeight: "bold", color: "#2563EB" },
  paymentOption: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: "#E5E7EB", marginBottom: 12,
  },
  paymentOptionActive: { borderColor: "#2563EB", backgroundColor: "#F0F4FF" },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: "#D1D5DB", justifyContent: "center", alignItems: "center",
  },
  radioActive: { borderColor: "#2563EB" },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#2563EB" },
  paymentTitle: { fontSize: 15, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  paymentDesc: { fontSize: 12, color: "#6B7280", marginTop: 2, textAlign: "right" },
  bottomBar: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 16, gap: 8,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  vodafoneInfo: {
    backgroundColor: "#FFF7ED", borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: "#FDBA74", marginTop: 4,
  },
  vodafoneTitle: { fontSize: 14, fontWeight: "bold", color: "#1F2937", textAlign: "right", marginBottom: 8 },
  vodafoneNumberRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, marginBottom: 6,
  },
  vodafoneNumber: { fontSize: 22, fontWeight: "bold", color: "#DC2626", letterSpacing: 1 },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#EFF6FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  copyBtnText: { fontSize: 12, fontWeight: "600", color: "#2563EB" },
  vodafoneName: { fontSize: 15, fontWeight: "600", color: "#374151", textAlign: "center", marginBottom: 12 },
  vodafoneNote: {
    flexDirection: "row", gap: 8, backgroundColor: "#FFFBEB",
    borderRadius: 8, padding: 10, marginBottom: 10,
  },
  vodafoneNoteText: { fontSize: 13, color: "#92400E", flex: 1, textAlign: "right", lineHeight: 20 },
  vodafoneSafe: { alignItems: "center", marginTop: 4 },
  vodafoneSafeText: { fontSize: 14, fontWeight: "600", color: "#059669" },
});
