import { useEffect, useRef, useState, useCallback } from "react";
import {
  Text, View, TextInput, FlatList, ScrollView,
  Dimensions, ActivityIndicator, RefreshControl,
  I18nManager, StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const BANNER_HEIGHT = 160;
const BANNER_INTERVAL = 7000;

export default function HomeScreen() {
  const router = useRouter();
  const { addToCart, addToFavorites, isFavorite, isInCart } = useAppStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const bannerRef = useRef<FlatList>(null);

  const bannersQuery = trpc.banners.list.useQuery();
  const categoriesQuery = trpc.categories.list.useQuery();
  const medicinesQuery = trpc.medicines.list.useQuery();
  const searchMedicinesQuery = trpc.medicines.search.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );
  const categoryMedicinesQuery = trpc.medicines.byCategory.useQuery(
    { categoryId: selectedCategory! },
    { enabled: selectedCategory !== null }
  );

  const banners = bannersQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const allMedicines = medicinesQuery.data ?? [];
  const searchResults = searchMedicinesQuery.data ?? [];
  const categoryMedicines = categoryMedicinesQuery.data ?? [];

  const displayMedicines = searchQuery.length > 0
    ? searchResults
    : selectedCategory !== null
      ? categoryMedicines
      : allMedicines;

  // Auto-scroll banners every 7 seconds
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBanner(prev => {
        const next = (prev + 1) % banners.length;
        bannerRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, BANNER_INTERVAL);
    return () => clearInterval(interval);
  }, [banners.length]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      bannersQuery.refetch(),
      categoriesQuery.refetch(),
      medicinesQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const renderBanner = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => router.push(`/banner/${item.id}` as any)}
      style={({ pressed }) => [styles.bannerItem, pressed && { opacity: 0.9 }]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.bannerImage} contentFit="cover" />
      ) : (
        <View style={[styles.bannerImage, { backgroundColor: "#4169E1", justifyContent: "center", alignItems: "center" }]}>
          <MaterialIcons name="local-pharmacy" size={48} color="#fff" />
        </View>
      )}
      <View style={styles.bannerOverlay}>
        <Text style={styles.bannerTitle}>{item.title}</Text>
        {item.description ? <Text style={styles.bannerDesc}>{item.description}</Text> : null}
        <View style={styles.bannerButton}>
          <Text style={styles.bannerButtonText}>تفاصيل</Text>
        </View>
      </View>
    </Pressable>
  );

  const renderMedicine = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => router.push(`/medicine/${item.id}` as any)}
      style={({ pressed }) => [styles.medicineCard, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.medicineImage} contentFit="cover" />
      ) : (
        <View style={[styles.medicineImage, { backgroundColor: "#E8EDF3", justifyContent: "center", alignItems: "center" }]}>
          <MaterialIcons name="medication" size={40} color="#4169E1" />
        </View>
      )}
      <View style={styles.medicineInfo}>
        <Text style={styles.medicineName} numberOfLines={1}>{item.nameAr}</Text>
        <Text style={styles.medicineNameEn} numberOfLines={1}>{item.nameEn}</Text>
        <Text style={styles.medicinePrice}>{parseFloat(item.price).toFixed(2)} ج.م</Text>
      </View>
      <View style={styles.medicineActions}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            if (isFavorite(item.id)) return;
            addToFavorites({
              medicineId: item.id, nameAr: item.nameAr, nameEn: item.nameEn,
              price: item.price, imageUrl: item.imageUrl, categoryId: item.categoryId,
            });
          }}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name={isFavorite(item.id) ? "favorite" : "favorite-border"} size={20} color={isFavorite(item.id) ? "#DC2626" : "#6B7280"} />
        </Pressable>
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#4169E1]">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>صيدلية الشاذلي</Text>
            <Text style={styles.headerSubtitle}>أدويتك الموثوقة في أيدٍ أمينة</Text>
          </View>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={22} color="#6B7280" style={{ marginLeft: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن دواء..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.length > 0) setSelectedCategory(null);
              }}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4169E1" />}
        >
          {/* Banners */}
          {banners.length > 0 && (
            <View style={styles.bannerSection}>
              <FlatList
                ref={bannerRef}
                data={banners}
                renderItem={renderBanner}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={BANNER_WIDTH + 12}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16 }}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + 12));
                  setCurrentBanner(index);
                }}
                getItemLayout={(_, index) => ({
                  length: BANNER_WIDTH + 12,
                  offset: (BANNER_WIDTH + 12) * index,
                  index,
                })}
              />
              {/* Pagination dots */}
              <View style={styles.dotsContainer}>
                {banners.map((_, i) => (
                  <View key={i} style={[styles.dot, i === currentBanner && styles.dotActive]} />
                ))}
              </View>
              <Text style={styles.bannerCount}>{currentBanner + 1} من {banners.length}</Text>
            </View>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>الفئات</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                <Pressable
                  onPress={() => setSelectedCategory(null)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    selectedCategory === null && styles.categoryChipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.categoryChipText, selectedCategory === null && styles.categoryChipTextActive]}>الكل</Text>
                </Pressable>
                {categories.map((cat: any) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      selectedCategory === cat.id && styles.categoryChipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>{cat.nameAr}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Medicines */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الأدوية ({displayMedicines.length})</Text>
            {(medicinesQuery.isLoading || searchMedicinesQuery.isLoading || categoryMedicinesQuery.isLoading) ? (
              <ActivityIndicator size="large" color="#4169E1" style={{ marginTop: 20 }} />
            ) : displayMedicines.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="medication" size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  {searchQuery.length > 0 ? "لا توجد نتائج للبحث" : "لا توجد أدوية حالياً"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery.length > 0 ? "جرب كلمات بحث مختلفة" : "سيتم إضافة الأدوية قريباً"}
                </Text>
              </View>
            ) : (
              displayMedicines.map((med: any) => renderMedicine({ item: med }))
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
  header: { backgroundColor: "#4169E1", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16 },
  headerContent: { alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: "#fff", textAlign: "center" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4, textAlign: "center" },
  searchContainer: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, paddingHorizontal: 12, height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#1F2937", textAlign: "right", paddingHorizontal: 8 },
  body: { flex: 1, backgroundColor: "#fff" },
  bannerSection: { marginTop: 16 },
  bannerItem: { width: BANNER_WIDTH, height: BANNER_HEIGHT, borderRadius: 12, overflow: "hidden" },
  bannerImage: { width: "100%", height: "100%", borderRadius: 12 },
  bannerOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(26,60,110,0.55)", borderRadius: 12,
    justifyContent: "center", alignItems: "center", padding: 16,
  },
  bannerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff", textAlign: "center" },
  bannerDesc: { fontSize: 13, color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: 4 },
  bannerButton: {
    backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, marginTop: 10,
  },
  bannerButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  dotsContainer: { flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D1D5DB" },
  dotActive: { backgroundColor: "#4169E1", width: 20 },
  bannerCount: { textAlign: "center", fontSize: 12, color: "#6B7280", marginTop: 4 },
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937", marginBottom: 12, textAlign: "right" },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#4169E1", backgroundColor: "#fff",
  },
  categoryChipActive: { backgroundColor: "#4169E1" },
  categoryChipText: { fontSize: 14, fontWeight: "600", color: "#4169E1" },
  categoryChipTextActive: { color: "#fff" },
  medicineCard: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 12,
    marginBottom: 12, padding: 12, borderWidth: 1, borderColor: "#E5E7EB",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  medicineImage: { width: 80, height: 80, borderRadius: 10 },
  medicineInfo: { flex: 1, marginHorizontal: 12, justifyContent: "center" },
  medicineName: { fontSize: 16, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  medicineNameEn: { fontSize: 12, color: "#6B7280", marginTop: 2, textAlign: "right" },
  medicinePrice: { fontSize: 16, fontWeight: "bold", color: "#4169E1", marginTop: 6, textAlign: "right" },
  medicineActions: { justifyContent: "center", alignItems: "center" },
  actionBtn: { padding: 8 },
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 16, color: "#6B7280", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#9CA3AF", marginTop: 4 },
});
