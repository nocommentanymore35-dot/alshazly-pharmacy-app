import { Text, View, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function BannerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const bannersQuery = trpc.banners.list.useQuery();
  const banner = bannersQuery.data?.find((b: any) => b.id === parseInt(id));

  if (bannersQuery.isLoading) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </ScreenContainer>
    );
  }

  if (!banner) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>الإعلان غير موجود</Text>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.8 }]}>
            <Text style={styles.backButtonText}>العودة</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-white">
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.7 }]}>
            <MaterialIcons name="arrow-forward" size={24} color="#2563EB" />
          </Pressable>
          <Text style={styles.headerTitle}>تفاصيل الإعلان</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {banner.imageUrl ? (
            <Image source={{ uri: banner.imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center" }]}>
              <MaterialIcons name="campaign" size={80} color="#fff" />
            </View>
          )}

          <View style={styles.content}>
            <Text style={styles.title}>{banner.title}</Text>
            {banner.description && (
              <Text style={styles.description}>{banner.description}</Text>
            )}
          </View>
        </ScrollView>
      </View>
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
  image: { width: "100%", height: 250 },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  description: { fontSize: 16, color: "#4B5563", lineHeight: 26, marginTop: 16, textAlign: "right" },
});
