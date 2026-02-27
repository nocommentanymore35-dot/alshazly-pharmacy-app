import { useState, useEffect } from "react";
import { Text, View, TextInput, ScrollView, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  received: { label: "تم استقبال طلبكم و جارى تحضيره", color: "#2563EB", icon: "inbox" },
  preparing: { label: "تم استقبال طلبكم و جارى تحضيره", color: "#F59E0B", icon: "hourglass-empty" },
  shipped: { label: "تم شحن الطلب وسيتم التواصل معك هاتفياً", color: "#8B5CF6", icon: "local-shipping" },
  delivered: { label: "تم تسليم الطلب إليكم بنجاح", color: "#22C55E", icon: "check-circle" },
};

export default function ProfileScreen() {
  const router = useRouter();
  const { state, setProfile, dispatch } = useAppStore();
  const [fullName, setFullName] = useState(state.profile.fullName);
  const [phone, setPhone] = useState(state.profile.phone);
  const [address, setAddress] = useState(state.profile.address);
  const [saving, setSaving] = useState(false);

  const customerMutation = trpc.customers.getOrCreate.useMutation();
  const updateMutation = trpc.customers.update.useMutation();

  const ordersQuery = trpc.orders.byCustomer.useQuery(
    { customerId: state.customerId! },
    { enabled: !!state.customerId }
  );

  useEffect(() => {
    setFullName(state.profile.fullName);
    setPhone(state.profile.phone);
    setAddress(state.profile.address);
  }, [state.profile]);

  // Register customer on mount
  useEffect(() => {
    if (state.deviceId && !state.customerId) {
      customerMutation.mutate(
        { deviceId: state.deviceId },
        {
          onSuccess: (data) => {
            if (data) {
              dispatch({ type: "SET_CUSTOMER_ID", payload: data.id });
              if (data.fullName) setProfile({ fullName: data.fullName, phone: data.phone ?? "", address: data.address ?? "" });
            }
          },
        }
      );
    }
  }, [state.deviceId]);

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("خطأ", "يرجى إدخال الاسم الكامل");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("خطأ", "يرجى إدخال رقم الهاتف");
      return;
    }
    if (!address.trim()) {
      Alert.alert("خطأ", "يرجى إدخال العنوان");
      return;
    }

    setSaving(true);
    try {
      setProfile({ fullName: fullName.trim(), phone: phone.trim(), address: address.trim() });
      if (state.deviceId) {
        await updateMutation.mutateAsync({
          deviceId: state.deviceId,
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
        });
      }
      Alert.alert("تم الحفظ", "تم حفظ بياناتك بنجاح ـ يمكنك تعديل هذه البيانات فى اى وقت و حفظها ولكن لا تحذفها لانه سيتم استخدامها فى توصيل الطلب إليكم\n\nبياناتك آمنه و سريه تماما 🔒");
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ أثناء الحفظ");
    }
    setSaving(false);
  };

  const orders = ordersQuery.data ?? [];

  return (
    <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#2563EB]">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>الملف الشخصي</Text>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Profile Form */}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>بياناتك الشخصية</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>الاسم الكامل</Text>
              <View style={styles.inputContainer}>
                <MaterialIcons name="person" size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  placeholder="أدخل اسمك الكامل"
                  placeholderTextColor="#9CA3AF"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>رقم الهاتف</Text>
              <View style={styles.inputContainer}>
                <MaterialIcons name="phone" size={20} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  placeholder="أدخل رقم هاتفك"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>العنوان (مكان التوصيل)</Text>
              <View style={[styles.inputContainer, { height: 80, alignItems: "flex-start", paddingTop: 10 }]}>
                <MaterialIcons name="location-on" size={20} color="#6B7280" style={{ marginTop: 2 }} />
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: "top" }]}
                  placeholder="أدخل عنوانك بالتفصيل"
                  placeholderTextColor="#9CA3AF"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
              </View>
            </View>

            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}>حفظ البيانات</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Orders Section */}
          <View style={styles.ordersSection}>
            <Text style={styles.formTitle}>طلباتي</Text>

            {ordersQuery.isLoading ? (
              <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
            ) : orders.length === 0 ? (
              <View style={styles.emptyOrders}>
                <MaterialIcons name="receipt-long" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>لا توجد طلبات سابقة</Text>
              </View>
            ) : (
              orders.map((order: any) => {
                const statusInfo = STATUS_MAP[order.status] ?? STATUS_MAP.received;
                return (
                  <Pressable
                    key={order.id}
                    onPress={() => router.push(`/order-tracking?orderId=${order.id}` as any)}
                    style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.9 }]}
                  >
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderId}>طلب #{order.id}</Text>
                      <Text style={styles.orderDate}>
                        {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                      </Text>
                    </View>
                    <View style={styles.orderStatus}>
                      <MaterialIcons name={statusInfo.icon as any} size={18} color={statusInfo.color} />
                      <Text style={[styles.orderStatusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                    <View style={styles.orderFooter}>
                      <Text style={styles.orderTotal}>{parseFloat(order.totalAmount).toFixed(2)} ج.م</Text>
                      <Text style={styles.orderPayment}>
                        {order.paymentMethod === "cash" ? "الدفع عند الاستلام" : "فودافون كاش"}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#2563EB", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
    alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  body: { flex: 1 },
  formSection: { padding: 16 },
  formTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937", marginBottom: 16, textAlign: "right" },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6, textAlign: "right" },
  inputContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB",
    borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 12, height: 48,
  },
  input: { flex: 1, fontSize: 15, color: "#1F2937", textAlign: "right", marginHorizontal: 8 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 14, gap: 8, marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  ordersSection: { padding: 16, borderTopWidth: 8, borderTopColor: "#F3F4F6" },
  emptyOrders: { alignItems: "center", paddingVertical: 30 },
  emptyText: { fontSize: 15, color: "#6B7280", marginTop: 12 },
  orderCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 12,
  },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  orderId: { fontSize: 15, fontWeight: "bold", color: "#1F2937" },
  orderDate: { fontSize: 13, color: "#6B7280" },
  orderStatus: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  orderStatusText: { fontSize: 13, fontWeight: "600" },
  orderFooter: { flexDirection: "row", justifyContent: "space-between" },
  orderTotal: { fontSize: 15, fontWeight: "bold", color: "#2563EB" },
  orderPayment: { fontSize: 13, color: "#6B7280" },
});
