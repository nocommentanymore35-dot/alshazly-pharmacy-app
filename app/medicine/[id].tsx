import { useState } from "react";
import { Text, View, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function MedicineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart, addToFavorites, isFavorite, isInCart } = useAppStore();
  const [quantity, setQuantity] = useState(1);

  const medicineQuery = trpc.medicines.byId.useQuery({ id: parseInt(id) });
  const medicine = medicineQuery.data;

  if (medicineQuery.isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A3C6E" />
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

  const handleAddToCart = () => {
    addToCart({
      medicineId: medicine.id,
      nameAr: medicine.nameAr,
      nameEn: medicine.nameEn,
      price: medicine.price,
      quantity,
      imageUrl: medicine.imageUrl ?? undefined,
    });
    router.back();
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

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-white">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-forward" size={24} color="#1A3C6E" />
          </Pressable>
          <Text style={styles.headerTitle}>تفاصيل الدواء</Text>
          <Pressable onPress={handleToggleFavorite} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name={isFavorite(medicine.id) ? "favorite" : "favorite-border"} size={24} color={isFavorite(medicine.id) ? "#DC2626" : "#6B7280"} />
          </Pressable>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Image */}
          {medicine.imageUrl ? (
            <Image source={{ uri: medicine.imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: "#E8EDF3", justifyContent: "center", alignItems: "center" }]}>
              <MaterialIcons name="medication" size={80} color="#1A3C6E" />
            </View>
          )}

          {/* Info */}
          <View style={styles.infoSection}>
            <Text style={styles.nameAr}>{medicine.nameAr}</Text>
            <Text style={styles.nameEn}>{medicine.nameEn}</Text>
            <Text style={styles.price}>{parseFloat(medicine.price).toFixed(2)} ج.م</Text>

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
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomBar}>
          {/* Quantity Selector */}
          <View style={styles.quantityContainer}>
            <Pressable
              onPress={() => setQuantity(q => Math.max(1, q - 1))}
              style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="remove" size={20} color="#1A3C6E" />
            </Pressable>
            <Text style={styles.qtyText}>{quantity}</Text>
            <Pressable
              onPress={() => setQuantity(q => q + 1)}
              style={({ pressed }) => [styles.qtyBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="add" size={20} color="#1A3C6E" />
            </Pressable>
          </View>

          {/* Add to Cart Button */}
          <Pressable
            onPress={handleAddToCart}
            disabled={isInCart(medicine.id)}
            style={({ pressed }) => [
              styles.addToCartBtn,
              isInCart(medicine.id) && styles.addToCartBtnDisabled,
              pressed && !isInCart(medicine.id) && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
          >
            <MaterialIcons name="shopping-cart" size={20} color="#fff" />
            <Text style={styles.addToCartText}>
              {isInCart(medicine.id) ? "في السلة" : "إضافة للسلة"}
            </Text>
            <Text style={styles.addToCartPrice}>
              {(parseFloat(medicine.price) * quantity).toFixed(2)} ج.م
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16, color: "#6B7280" },
  backButton: { marginTop: 16, backgroundColor: "#1A3C6E", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  backButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  headerBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937" },
  body: { flex: 1 },
  image: { width: "100%", height: 250 },
  infoSection: { padding: 16 },
  nameAr: { fontSize: 22, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  nameEn: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "right" },
  price: { fontSize: 24, fontWeight: "bold", color: "#1A3C6E", marginTop: 12, textAlign: "right" },
  descSection: { marginTop: 20 },
  descTitle: { fontSize: 16, fontWeight: "bold", color: "#1F2937", marginBottom: 8, textAlign: "right" },
  descText: { fontSize: 14, color: "#4B5563", lineHeight: 22, textAlign: "right" },
  descTitleEn: { fontSize: 16, fontWeight: "bold", color: "#1F2937", marginBottom: 8, textAlign: "left" },
  descTextEn: { fontSize: 14, color: "#4B5563", lineHeight: 22, textAlign: "left" },
  bottomBar: {
    flexDirection: "row", alignItems: "center", padding: 16,
    borderTopWidth: 1, borderTopColor: "#E5E7EB", backgroundColor: "#fff",
    gap: 12,
  },
  quantityContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6",
    borderRadius: 10, paddingHorizontal: 4, paddingVertical: 4,
  },
  qtyBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center", borderRadius: 8 },
  qtyText: { fontSize: 18, fontWeight: "bold", color: "#1F2937", minWidth: 32, textAlign: "center" },
  addToCartBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1A3C6E", borderRadius: 12, paddingVertical: 14, gap: 8,
  },
  addToCartBtnDisabled: { backgroundColor: "#9CA3AF" },
  addToCartText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
  addToCartPrice: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
});
