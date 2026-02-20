import { Text, View, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const STATUSES = [
  { key: "received", label: "تم استقبال طلبكم و جارى تحضيره", icon: "inbox" },
  { key: "preparing", label: "تم استقبال طلبكم و جارى تحضيره", icon: "hourglass-empty" },
  { key: "shipped", label: "تم شحن الطلب وسيتم التواصل معك هاتفياً", icon: "local-shipping" },
  { key: "delivered", label: "تم تسليم الطلب إليكم بنجاح", icon: "check-circle" },
];

function getStatusIndex(status: string) {
  const idx = STATUSES.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();

  const orderItemsQuery = trpc.orders.items.useQuery({ orderId: parseInt(orderId) });
  const ordersQuery = trpc.orders.byCustomer.useQuery(
    { customerId: 0 },
    { enabled: false }
  );

  // We need to get the order details - use listAll for simplicity
  const allOrdersQuery = trpc.orders.listAll.useQuery();
  const order = allOrdersQuery.data?.find((o: any) => o.id === parseInt(orderId));
  const items = orderItemsQuery.data ?? [];
  const currentStatusIndex = order ? getStatusIndex(order.status) : 0;

  if (allOrdersQuery.isLoading || orderItemsQuery.isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4169E1" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-white">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-forward" size={24} color="#4169E1" />
          </Pressable>
          <Text style={styles.headerTitle}>تتبع الطلب #{orderId}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Status Timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>حالة الطلب</Text>
            {STATUSES.map((status, index) => {
              const isActive = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              return (
                <View key={status.key} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={[
                      styles.timelineDot,
                      isActive && styles.timelineDotActive,
                      isCurrent && styles.timelineDotCurrent,
                    ]}>
                      <MaterialIcons
                        name={status.icon as any}
                        size={16}
                        color={isActive ? "#fff" : "#D1D5DB"}
                      />
                    </View>
                    {index < STATUSES.length - 1 && (
                      <View style={[
                        styles.timelineConnector,
                        isActive && styles.timelineConnectorActive,
                      ]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[
                      styles.timelineLabel,
                      isActive && styles.timelineLabelActive,
                      isCurrent && styles.timelineLabelCurrent,
                    ]}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Order Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>تفاصيل الطلب</Text>
            {items.map((item: any) => (
              <View key={item.id} style={styles.orderItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.medicineName}</Text>
                  <Text style={styles.itemQty}>الكمية: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  {(parseFloat(item.price) * item.quantity).toFixed(2)} ج.م
                </Text>
              </View>
            ))}
            {order && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>الإجمالي</Text>
                <Text style={styles.totalAmount}>{parseFloat(order.totalAmount).toFixed(2)} ج.م</Text>
              </View>
            )}
          </View>

          {/* Payment Info */}
          {order && (
            <View style={styles.paymentSection}>
              <Text style={styles.sectionTitle}>معلومات الدفع</Text>
              <View style={styles.paymentCard}>
                <MaterialIcons
                  name={order.paymentMethod === "cash" ? "payments" : "phone-android"}
                  size={24}
                  color="#4169E1"
                />
                <Text style={styles.paymentText}>
                  {order.paymentMethod === "cash" ? "الدفع عند الاستلام" : "فودافون كاش"}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937" },
  body: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", color: "#1F2937", marginBottom: 16, textAlign: "right" },
  timelineSection: { padding: 16, backgroundColor: "#fff", marginBottom: 8 },
  timelineItem: { flexDirection: "row", minHeight: 60 },
  timelineLine: { alignItems: "center", width: 40 },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB",
    justifyContent: "center", alignItems: "center",
  },
  timelineDotActive: { backgroundColor: "#4169E1" },
  timelineDotCurrent: { backgroundColor: "#22C55E" },
  timelineConnector: { width: 3, flex: 1, backgroundColor: "#E5E7EB", marginVertical: 4 },
  timelineConnectorActive: { backgroundColor: "#4169E1" },
  timelineContent: { flex: 1, paddingHorizontal: 12, paddingTop: 6 },
  timelineLabel: { fontSize: 14, color: "#9CA3AF" },
  timelineLabelActive: { color: "#374151" },
  timelineLabelCurrent: { color: "#4169E1", fontWeight: "bold" },
  itemsSection: { padding: 16, backgroundColor: "#fff", marginBottom: 8 },
  orderItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
  },
  itemName: { fontSize: 14, fontWeight: "600", color: "#1F2937", textAlign: "right" },
  itemQty: { fontSize: 12, color: "#6B7280", textAlign: "right" },
  itemPrice: { fontSize: 14, fontWeight: "bold", color: "#4169E1" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 12, marginTop: 4,
  },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: "#1F2937" },
  totalAmount: { fontSize: 20, fontWeight: "bold", color: "#4169E1" },
  paymentSection: { padding: 16, backgroundColor: "#fff" },
  paymentCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#F0F4FF", borderRadius: 12, padding: 16,
  },
  paymentText: { fontSize: 15, fontWeight: "600", color: "#4169E1" },
});
