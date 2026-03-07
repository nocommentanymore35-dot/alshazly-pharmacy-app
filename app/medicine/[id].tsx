import { useState } from "react";
import { Text, View, ScrollView, ActivityIndicator, StyleSheet, Platform, Animated as RNAnimated, Alert } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAppStore, UnitType, getPricePerUnit, getUnitLabel } from "@/lib/store";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp, FadeIn, ZoomIn, SlideInDown } from "react-native-reanimated";
import { BounceButton, CartSuccessAnimation, FadeSlideSection } from "@/components/AnimatedComponents";

export default function MedicineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart, addToFavorites, isFavorite, isInCart } = useAppStore();
  const [quantity, setQuantity] = useState(1);
  const [unitType, setUnitType] = useState<UnitType>("box");
  const [showToast, setShowToast] = useState(false);
  const toastOpacity = useState(() => new RNAnimated.Value(0))[0];
  const insets = useSafeAreaInsets();

  const medicineQuery = trpc.medicines.byId.useQuery({ id: parseInt(id) });
  const medicine = medicineQuery.data;
  const { state: { customerId } } = useAppStore();
  
  // Stock alert
  const [alertRegistered, setAlertRegistered] = useState(false);
  const [alertLoading, setAlertLoading] = useState(false);
  const stockAlertCheck = trpc.stockAlerts.check.useQuery(
    { customerId: customerId ?? 0, medicineId: parseInt(id) },
    { enabled: !!customerId && !!medicine && (medicine.stock ?? 0) <= 0 }
  );
  const registerAlertMutation = trpc.stockAlerts.register.useMutation();
  const removeAlertMutation = trpc.stockAlerts.remove.useMutation();
  
  const handleStockAlert = async () => {
    if (!customerId) {
      Alert.alert('تنبيه', 'يرجى تسجيل الدخول أولاً');
      return;
    }
    setAlertLoading(true);
    try {
      if (alertRegistered || stockAlertCheck.data) {
        await removeAlertMutation.mutateAsync({ customerId, medicineId: parseInt(id) });
        setAlertRegistered(false);
        stockAlertCheck.refetch();
        Alert.alert('تم', 'تم إلغاء التنبيه');
      } else {
        const result = await registerAlertMutation.mutateAsync({ customerId, medicineId: parseInt(id) });
        setAlertRegistered(true);
        Alert.alert('تم', result.message);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'حدث خطأ');
    }
    setAlertLoading(false);
  };

  if (medicineQuery.isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </ScreenContainer>
    );
  }

  if (!medicine) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>الدواء غير موجود</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.8 }]}>
            <Text style={styles.backButtonText}>العودة</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const stripsPerBox = medicine.strips || 1;
  const boxPrice = parseFloat(medicine.price);
  const stripPrice = boxPrice / stripsPerBox;
  const currentUnitPrice = unitType === "strip" ? stripPrice : boxPrice;
  const totalPrice = currentUnitPrice * quantity;

  const isOutOfStock = (medicine.stock ?? 0) <= 0;
  // حساب أقصى كمية يمكن طلبها حسب نوع الوحدة
  const stockCount = medicine.stock ?? 0;
  const maxQuantity = unitType === "strip" ? stockCount * stripsPerBox : stockCount;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      Alert.alert("غير متوفر", "هذا الصنف غير متوفر حالياً");
      return;
    }
    addToCart({
      medicineId: medicine.id,
      nameAr: medicine.nameAr,
      nameEn: medicine.nameEn,
      price: medicine.price,
      quantity,
      unitType,
      stripsPerBox,
      imageUrl: medicine.imageUrl ?? undefined,
    });
    // Show toast
    setShowToast(true);
    RNAnimated.sequence([
      RNAnimated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.delay(1500),
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setShowToast(false);
      router.back();
    });
  };

  const handleToggleFavorite = () => {
    if (isFavorite(medicine.id)) return;
    addToFavorites({
      medicineId: medicine.id,
      nameAr: medicine.nameAr,
      nameEn: medicine.nameEn,
      price: medicine.price,
      imageUrl: medicine.imageUrl ?? undefined,
      categoryId: medicine.categoryId,
    });
  };

  // When switching unit type, reset quantity to 1
  const handleUnitChange = (newUnit: UnitType) => {
    if (newUnit !== unitType) {
      setUnitType(newUnit);
      setQuantity(1);
    }
  };

  // إذا تجاوزت الكمية الحد الأقصى (مثلاً بعد تغيير الوحدة) نعيد ضبطها
  if (medicine && quantity > maxQuantity && maxQuantity > 0) {
    setQuantity(maxQuantity);
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-white">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-forward" size={24} color="#2563EB" />
          </Pressable>
          <Text style={styles.headerTitle}>تفاصيل الدواء</Text>
          <Pressable onPress={handleToggleFavorite} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name={isFavorite(medicine.id) ? "favorite" : "favorite-border"} size={24} color={isFavorite(medicine.id) ? "#DC2626" : "#6B7280"} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Image with fade animation */}
          <Animated.View entering={FadeIn.duration(500)}>
            {medicine.imageUrl && !medicine.imageUrl.includes('railway.app/uploads/') ? (
              <Image source={{ uri: medicine.imageUrl }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={[styles.image, { backgroundColor: "#E8EDF3", justifyContent: "center", alignItems: "center" }]}>
                <MaterialIcons name="medication" size={80} color="#2563EB" />
              </View>
            )}
            {/* Stock badge */}
            <View style={{
              position: "absolute", top: 12, right: 12,
              backgroundColor: (medicine.stock ?? 0) > 0 ? "#22C55E" : "#DC2626",
              borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
              flexDirection: "row", alignItems: "center", gap: 4,
            }}>
              <MaterialIcons name={(medicine.stock ?? 0) > 0 ? "check-circle" : "cancel"} size={14} color="#fff" />
              <Text style={{ fontSize: 12, color: "#fff", fontWeight: "bold" }}>
                {(medicine.stock ?? 0) > 0 ? "متوفر" : "غير متوفر"}
              </Text>
            </View>
          </Animated.View>

          {/* Info with slide animation */}
          <Animated.View entering={FadeInDown.delay(200).duration(500).springify()} style={styles.infoSection}>
            <Text style={styles.nameAr}>{medicine.nameAr}</Text>
            <Text style={styles.nameEn}>{medicine.nameEn}</Text>
            
            {/* Price Info */}
            <View style={styles.priceSection}>
              <Text style={styles.priceLabel}>سعر العلبة</Text>
              <Text style={styles.price}>{boxPrice.toFixed(2)} ج.م</Text>
              {stripsPerBox > 1 && (
                <Text style={styles.stripPriceInfo}>
                  ({stripsPerBox} شرائط • سعر الشريط: {stripPrice.toFixed(2)} ج.م)
                </Text>
              )}
            </View>

            {/* Unit Type Selector - only show if strips > 1 */}
            {stripsPerBox > 1 && (
              <View style={styles.unitSection}>
                <View style={styles.unitSectionTitleRow}>
                  <MaterialIcons name="info" size={20} color="#F59E0B" />
                  <Text style={styles.unitSectionTitle}>اختر وحدة الشراء</Text>
                </View>
                <View style={styles.unitToggleContainer}>
                  <Pressable
                    onPress={() => handleUnitChange("strip")}
                    style={({ pressed }) => [
                      styles.unitToggleBtn,
                      unitType === "strip" && styles.unitToggleBtnActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <MaterialIcons 
                      name="view-column" 
                      size={20} 
                      color={unitType === "strip" ? "#fff" : "#2563EB"} 
                    />
                    <Text style={[
                      styles.unitToggleText,
                      unitType === "strip" && styles.unitToggleTextActive,
                    ]}>شريط</Text>
                    <Text style={[
                      styles.unitTogglePrice,
                      unitType === "strip" && styles.unitTogglePriceActive,
                    ]}>{stripPrice.toFixed(2)} ج.م</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleUnitChange("box")}
                    style={({ pressed }) => [
                      styles.unitToggleBtn,
                      unitType === "box" && styles.unitToggleBtnActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <MaterialIcons 
                      name="inventory-2" 
                      size={20} 
                      color={unitType === "box" ? "#fff" : "#2563EB"} 
                    />
                    <Text style={[
                      styles.unitToggleText,
                      unitType === "box" && styles.unitToggleTextActive,
                    ]}>علبة</Text>
                    <Text style={[
                      styles.unitTogglePrice,
                      unitType === "box" && styles.unitTogglePriceActive,
                    ]}>{boxPrice.toFixed(2)} ج.م</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {medicine.descriptionAr && (
              <View style={styles.descSection}>
                <Text style={styles.descTitle}>الوصف</Text>
                <Text style={styles.descText}>{medicine.descriptionAr}</Text>
              </View>
            )}

            {medicine.descriptionEn && (
              <View style={styles.descSection}>
                <Text style={styles.descTitleEn}>Description</Text>
                <Text style={styles.descTextEn}>{medicine.descriptionEn}</Text>
              </View>
            )}
          </Animated.View>

          <View style={{ height: 180 }} />
        </ScrollView>

        {/* Bottom Action Bar with slide-up animation */}
        <Animated.View entering={SlideInDown.delay(400).duration(500).springify()} style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Quantity Selector with unit label */}
          <View style={styles.quantitySection}>
            <View style={styles.quantityContainer}>
              <Pressable
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="remove" size={20} color="#2563EB" />
              </Pressable>
              <Text style={styles.qtyText}>{quantity}</Text>
              <Pressable
                onPress={() => setQuantity(q => Math.min(q + 1, maxQuantity))}
                disabled={quantity >= maxQuantity}
                style={({ pressed }) => [styles.qtyBtn, quantity >= maxQuantity && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="add" size={20} color={quantity >= maxQuantity ? "#9CA3AF" : "#2563EB"} />
              </Pressable>
            </View>
            <Text style={styles.unitLabel}>
              {getUnitLabel(unitType, quantity)}
            </Text>
            <Text style={{ fontSize: 11, color: "#6B7280", textAlign: "center" }}>
              (الحد الأقصى: {maxQuantity})
            </Text>
          </View>

          {/* Add to Cart Button with Bounce Animation */}
          <BounceButton
            onPress={handleAddToCart}
            disabled={isInCart(medicine.id) || isOutOfStock}
            style={[
              styles.addToCartBtn,
              (isInCart(medicine.id) || isOutOfStock) && styles.addToCartBtnDisabled,
              isOutOfStock && { backgroundColor: "#DC2626", opacity: 0.7 },
            ]}
          >
            <MaterialIcons name={isOutOfStock ? "remove-shopping-cart" : "shopping-cart"} size={24} color="#fff" />
            <Text style={styles.addToCartText}>
              {isOutOfStock ? "غير متوفر حالياً" : isInCart(medicine.id) ? "في السلة" : "إضافة للسلة"}
            </Text>
            {!isOutOfStock && (
              <Text style={styles.addToCartPrice}>
                {totalPrice.toFixed(2)} ج.م
              </Text>
            )}
          </BounceButton>

          {/* Notify When Available Button */}
          {isOutOfStock && (
            <Pressable
              onPress={handleStockAlert}
              disabled={alertLoading}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                backgroundColor: (alertRegistered || stockAlertCheck.data) ? '#F59E0B' : '#7C3AED',
                borderRadius: 12, paddingVertical: 14, marginTop: 8,
              }, pressed && { opacity: 0.85 }]}
            >
              {alertLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons
                    name={(alertRegistered || stockAlertCheck.data) ? 'notifications-off' : 'notifications-active'}
                    size={22} color="#fff"
                  />
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                    {(alertRegistered || stockAlertCheck.data) ? 'إلغاء التنبيه' : 'أعلمني عند التوفر'}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </Animated.View>
      </View>

      {/* Toast Message */}
      {showToast && (
        <RNAnimated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
          <View style={styles.toast}>
            <MaterialIcons name="check-circle" size={24} color="#22C55E" />
            <Text style={styles.toastText}>تم إضافة الصنف إلى عربة التسوق بنجاح</Text>
          </View>
        </RNAnimated.View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: "#6B7280" },
  backButton: { marginTop: 16, backgroundColor: "#2563EB", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937" },
  body: { flex: 1 },
  image: { width: "100%", height: 200, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  infoSection: { padding: 16 },
  nameAr: { fontSize: 22, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  nameEn: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "right" },
  priceSection: { marginTop: 12, alignItems: "flex-end" },
  priceLabel: { fontSize: 13, color: "#6B7280" },
  price: { fontSize: 24, fontWeight: "bold", color: "#2563EB", marginTop: 2 },
  stripPriceInfo: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  
  // Unit Type Selector
  unitSection: { marginTop: 20 },
  unitSectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  unitSectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  unitToggleContainer: { flexDirection: "row", gap: 12 },
  unitToggleBtn: {
    flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 2, borderColor: "#2563EB", backgroundColor: "#F0F4FF",
    gap: 4,
  },
  unitToggleBtnActive: {
    backgroundColor: "#2563EB", borderColor: "#2563EB",
  },
  unitToggleText: { fontSize: 16, fontWeight: "bold", color: "#2563EB" },
  unitToggleTextActive: { color: "#fff" },
  unitTogglePrice: { fontSize: 13, color: "#6B7280" },
  unitTogglePriceActive: { color: "rgba(255,255,255,0.85)" },

  descSection: { marginTop: 20 },
  descTitle: { fontSize: 16, fontWeight: "bold", color: "#1F2937", marginBottom: 8, textAlign: "right" },
  descText: { fontSize: 14, color: "#4B5563", lineHeight: 22, textAlign: "right" },
  descTitleEn: { fontSize: 16, fontWeight: "bold", color: "#1F2937", marginBottom: 8, textAlign: "left" },
  descTextEn: { fontSize: 14, color: "#4B5563", lineHeight: 22, textAlign: "left" },
  bottomBar: {
    paddingHorizontal: 16, paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: "#E5E7EB", backgroundColor: "#fff",
    gap: 10,
  },
  quantitySection: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
  },
  quantityContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6",
    borderRadius: 10, paddingHorizontal: 4, paddingVertical: 4,
  },
  qtyBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  qtyText: { fontSize: 18, fontWeight: "bold", color: "#1F2937", minWidth: 32, textAlign: "center" },
  unitLabel: { fontSize: 15, fontWeight: "600", color: "#2563EB" },
  addToCartBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#2563EB", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 20, gap: 10,
    width: "100%",
  },
  addToCartBtnDisabled: { backgroundColor: "#9CA3AF" },
  addToCartText: { color: "#fff", fontSize: 18, fontWeight: "bold", letterSpacing: 0.3 },
  addToCartPrice: { color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "600" },
  toastContainer: {
    position: "absolute", top: "40%", left: 0, right: 0, alignItems: "center", zIndex: 999,
  },
  toast: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  toastText: { fontSize: 15, fontWeight: "600", color: "#1F2937", textAlign: "right" },
});
