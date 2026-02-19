import { useState } from "react";
import { Text, View, ScrollView, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

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
        items: state.cart.map(item => ({
          medicineId: item.medicineId,
          medicineName: item.nameAr,
          quantity: item.quantity,
          price: item.price,
        })),
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
            <MaterialIcons name="arrow-forward" size={24} color="#1A3C6E" />
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
              {state.cart.map((item) => (
                <View key={item.medicineId} style={styles.orderItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderItemName}>{item.nameAr}</Text>
                    <Text style={styles.orderItemQty}>الكمية: {item.quantity}</Text>
                  </View>
                  <Text style={styles.orderItemPrice}>
                    {(parseFloat(item.price) * item.quantity).toFixed(2)} ج.م
                  </Text>
                </View>
              ))}
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
              <MaterialIcons name="payments" size={24} color={paymentMethod === "cash" ? "#1A3C6E" : "#6B7280"} />
              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={[styles.paymentTitle, paymentMethod === "cash" && { color: "#1A3C6E" }]}>
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
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  orderItemName: { fontSize: 14, fontWeight: "600", color: "#1F2937", textAlign: "right" },
  orderItemQty: { fontSize: 12, color: "#6B7280", textAlign: "right" },
  orderItemPrice: { fontSize: 14, fontWeight: "bold", color: "#1A3C6E" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  totalAmount: { fontSize: 20, fontWeight: "bold", color: "#1A3C6E" },
  paymentOption: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: "#E5E7EB", marginBottom: 12,
  },
  paymentOptionActive: { borderColor: "#1A3C6E", backgroundColor: "#F0F4FF" },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: "#D1D5DB", justifyContent: "center", alignItems: "center",
  },
  radioActive: { borderColor: "#1A3C6E" },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#1A3C6E" },
  paymentTitle: { fontSize: 15, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  paymentDesc: { fontSize: 12, color: "#6B7280", marginTop: 2, textAlign: "right" },
  bottomBar: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1A3C6E", borderRadius: 12, paddingVertical: 16, gap: 8,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
});
