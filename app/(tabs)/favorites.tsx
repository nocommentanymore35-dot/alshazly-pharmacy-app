import { Text, View, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore, FavoriteItem } from "@/lib/store";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function FavoritesScreen() {
  const router = useRouter();
  const { state, removeFromFavorites, addToCart, isInCart } = useAppStore();
  const { favorites } = state;

  const handleAddToCart = (item: FavoriteItem) => {
    if (isInCart(item.medicineId)) return;
    addToCart({
      medicineId: item.medicineId,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      price: item.price,
      quantity: 1,
      imageUrl: item.imageUrl,
    });
  };

  const renderFavoriteItem = ({ item }: { item: FavoriteItem }) => (
    <Pressable
      onPress={() => router.push(`/medicine/${item.medicineId}` as any)}
      style={({ pressed }) => [styles.favItem, pressed && { opacity: 0.9 }]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} contentFit="cover" />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: "#E8EDF3", justifyContent: "center", alignItems: "center" }]}>
          <MaterialIcons name="medication" size={30} color="#4169E1" />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.nameAr}</Text>
        <Text style={styles.itemNameEn} numberOfLines={1}>{item.nameEn}</Text>
        <Text style={styles.itemPrice}>{parseFloat(item.price).toFixed(2)} ج.م</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => handleAddToCart(item)}
          style={({ pressed }) => [
            styles.addBtn,
            isInCart(item.medicineId) && styles.addBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <MaterialIcons name="shopping-cart" size={18} color={isInCart(item.medicineId) ? "#9CA3AF" : "#4169E1"} />
        </Pressable>
        <Pressable
          onPress={() => removeFromFavorites(item.medicineId)}
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name="favorite" size={18} color="#DC2626" />
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#4169E1]">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>المفضلة</Text>
          <Text style={styles.headerCount}>{favorites.length} عنصر</Text>
        </View>

        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="favorite-border" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>لا توجد أدوية مفضلة</Text>
            <Text style={styles.emptySubtext}>اضغط على أيقونة القلب لإضافة أدوية للمفضلة</Text>
          </View>
        ) : (
          <FlatList
            data={favorites}
            renderItem={renderFavoriteItem}
            keyExtractor={(item) => item.medicineId.toString()}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListFooterComponent={<View style={{ height: 80 }} />}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#4169E1", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerCount: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 18, color: "#6B7280", marginTop: 16 },
  emptySubtext: { fontSize: 14, color: "#9CA3AF", marginTop: 4, textAlign: "center", paddingHorizontal: 40 },
  favItem: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  itemImage: { width: 70, height: 70, borderRadius: 10 },
  itemInfo: { flex: 1, marginHorizontal: 12, justifyContent: "center" },
  itemName: { fontSize: 15, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  itemNameEn: { fontSize: 11, color: "#6B7280", textAlign: "right" },
  itemPrice: { fontSize: 15, fontWeight: "bold", color: "#4169E1", marginTop: 4, textAlign: "right" },
  actions: { justifyContent: "center", gap: 8 },
  addBtn: { padding: 8, backgroundColor: "#F3F4F6", borderRadius: 8 },
  addBtnDisabled: { backgroundColor: "#F9FAFB" },
  removeBtn: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8 },
});
