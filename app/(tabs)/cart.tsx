import { Text, View, FlatList, Alert, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore, CartItem } from "@/lib/store";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function CartScreen() {
  const router = useRouter();
  const { state, removeFromCart, clearCart, cartTotal } = useAppStore();
  const { cart } = state;

  const handleRemoveItem = (medicineId: number, name: string) => {
    Alert.alert(
      "حذف من السلة",
      `هل تريد حذف "${name}" من السلة؟`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => removeFromCart(medicineId) },
      ]
    );
  };

  const handleCheckout = () => {
    if (!state.profile.fullName || !state.profile.phone || !state.profile.address) {
      Alert.alert(
        "بيانات ناقصة",
        "يرجى إكمال بياناتك الشخصية (الاسم، رقم الهاتف، العنوان) في الملف الشخصي قبل إتمام الطلب.",
        [
          { text: "إلغاء", style: "cancel" },
          { text: "الملف الشخصي", onPress: () => router.push("/(tabs)/profile" as any) },
        ]
      );
      return;
    }
    router.push("/checkout" as any);
  };

  const renderCartItem = ({ item }: { item: CartItem }) => (
    <View style={styles.cartItem}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} contentFit="cover" />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: "#E8EDF3", justifyContent: "center", alignItems: "center" }]}>
          <MaterialIcons name="medication" size={30} color="#2563EB" />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.nameAr}</Text>
        <Text style={styles.itemNameEn} numberOfLines={1}>{item.nameEn}</Text>
        <View style={styles.itemDetails}>
          <Text style={styles.itemPrice}>{parseFloat(item.price).toFixed(2)} ج.م</Text>
          <Text style={styles.itemQty}>الكمية: {item.quantity}</Text>
        </View>
        <Text style={styles.itemTotal}>
          الإجمالي: {(parseFloat(item.price) * item.quantity).toFixed(2)} ج.م
        </Text>
      </View>
      <Pressable
        onPress={() => handleRemoveItem(item.medicineId, item.nameAr)}
        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
      >
        <MaterialIcons name="delete" size={22} color="#DC2626" />
      </Pressable>
    </View>
  );

  return (
    <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#2563EB]">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>السلة</Text>
          {cart.length > 0 && (
            <Pressable
              onPress={() => Alert.alert("تفريغ السلة", "هل تريد حذف جميع العناصر؟", [
                { text: "إلغاء", style: "cancel" },
                { text: "تفريغ", style: "destructive", onPress: clearCart },
              ])}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.clearText}>تفريغ السلة</Text>
            </Pressable>
          )}
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="shopping-cart" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>السلة فارغة</Text>
            <Text style={styles.emptySubtext}>أضف أدوية من الصفحة الرئيسية</Text>
          </View>
        ) : (
          <>
            <FlatList
              data={cart}
              renderItem={renderCartItem}
              keyExtractor={(item) => item.medicineId.toString()}
              contentContainerStyle={{ padding: 16 }}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              ListFooterComponent={<View style={{ height: 100 }} />}
            />

            {/* Bottom Total & Checkout */}
            <View style={styles.bottomBar}>
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>الإجمالي</Text>
                <Text style={styles.totalAmount}>{cartTotal().toFixed(2)} ج.م</Text>
              </View>
              <Pressable
                onPress={handleCheckout}
                style={({ pressed }) => [styles.checkoutBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
              >
                <Text style={styles.checkoutText}>تأكيد الطلب</Text>
                <MaterialIcons name="arrow-back" size={20} color="#fff" />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#2563EB", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  clearText: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 18, color: "#6B7280", marginTop: 16 },
  emptySubtext: { fontSize: 14, color: "#9CA3AF", marginTop: 4 },
  cartItem: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  itemImage: { width: 70, height: 70, borderRadius: 10 },
  itemInfo: { flex: 1, marginHorizontal: 12 },
  itemName: { fontSize: 15, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  itemNameEn: { fontSize: 11, color: "#6B7280", textAlign: "right" },
  itemDetails: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  itemPrice: { fontSize: 13, color: "#2563EB", fontWeight: "600" },
  itemQty: { fontSize: 13, color: "#6B7280" },
  itemTotal: { fontSize: 14, fontWeight: "bold", color: "#2563EB", marginTop: 4, textAlign: "right" },
  deleteBtn: { justifyContent: "center", padding: 8 },
  bottomBar: {
    padding: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB",
    backgroundColor: "#fff", gap: 12,
  },
  totalSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 16, color: "#6B7280" },
  totalAmount: { fontSize: 22, fontWeight: "bold", color: "#2563EB" },
  checkoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 14, gap: 8,
  },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
