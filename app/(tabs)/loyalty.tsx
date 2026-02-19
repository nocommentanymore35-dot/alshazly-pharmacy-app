import { useState } from "react";
import { Text, View, FlatList, StyleSheet, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore, LoyaltyTransaction } from "@/lib/store";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const POINTS_PER_ORDER = 50;

export default function LoyaltyScreen() {
  const { state } = useAppStore();
  const insets = useSafeAreaInsets();
  const { totalPoints, transactions } = state.loyalty;

  const currentYear = new Date().getFullYear();
  const yearTransactions = transactions.filter(t => {
    const txYear = new Date(t.date).getFullYear();
    return txYear === currentYear;
  });
  const yearOrderCount = yearTransactions.length;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, "0");
    const mins = d.getMinutes().toString().padStart(2, "0");
    return `${day}/${month}/${year} - ${hours}:${mins}`;
  };

  const renderTransaction = ({ item }: { item: LoyaltyTransaction }) => (
    <View style={styles.txItem}>
      <View style={styles.txIconContainer}>
        <MaterialIcons name="add-circle" size={24} color="#22C55E" />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDesc}>{item.description}</Text>
        <Text style={styles.txDate}>{formatDate(item.date)}</Text>
      </View>
      <View style={styles.txPointsContainer}>
        <Text style={styles.txPoints}>+{item.points}</Text>
        <Text style={styles.txPointsLabel}>نقطة</Text>
      </View>
    </View>
  );

  const ListHeader = () => (
    <View>
      {/* Points Card */}
      <View style={styles.pointsCard}>
        <View style={styles.pointsCardBg}>
          <View style={styles.pointsCardContent}>
            <View style={styles.pointsIconRow}>
              <MaterialIcons name="card-giftcard" size={32} color="#FFD700" />
              <Text style={styles.pointsCardTitle}>برنامج الولاء</Text>
            </View>
            <View style={styles.pointsValueRow}>
              <Text style={styles.pointsValue}>{totalPoints}</Text>
              <Text style={styles.pointsUnit}>نقطة</Text>
            </View>
            <Text style={styles.pointsSubtext}>
              عدد الطلبات هذا العام: {yearOrderCount}
            </Text>
          </View>
        </View>
      </View>

      {/* How it works */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>كيف يعمل البرنامج؟</Text>
        
        <View style={styles.infoCard}>
          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>اطلب من الصيدلية</Text>
              <Text style={styles.stepDesc}>قم بإتمام أي طلب من صيدلية الشاذلي</Text>
            </View>
          </View>

          <View style={styles.stepDivider} />

          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>اكسب {POINTS_PER_ORDER} نقطة</Text>
              <Text style={styles.stepDesc}>تحصل على {POINTS_PER_ORDER} نقطة مع كل عملية شراء تلقائياً</Text>
            </View>
          </View>

          <View style={styles.stepDivider} />

          <View style={styles.infoStep}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>ادخل السحب السنوي</Text>
              <Text style={styles.stepDesc}>في نهاية كل عام، يدخل جميع العملاء الذين لديهم نقاط في سحب عشوائي للفوز بجائزة قيّمة</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Annual Draw Info */}
      <View style={styles.drawSection}>
        <View style={styles.drawCard}>
          <View style={styles.drawHeader}>
            <MaterialIcons name="emoji-events" size={28} color="#FFD700" />
            <Text style={styles.drawTitle}>السحب العشوائي السنوي</Text>
          </View>
          <Text style={styles.drawDesc}>
            في نهاية كل عام، يتم إجراء سحب عشوائي بين جميع العملاء الذين قاموا بعمليات شراء خلال العام. كلما زادت نقاطك، زادت فرصتك في الفوز!
          </Text>
          <View style={styles.drawHighlight}>
            <MaterialIcons name="info-outline" size={18} color="#2563EB" />
            <Text style={styles.drawHighlightText}>
              كل {POINTS_PER_ORDER} نقطة = فرصة إضافية في السحب
            </Text>
          </View>
        </View>
      </View>

      {/* Transactions Header */}
      <View style={styles.txHeader}>
        <Text style={styles.txHeaderTitle}>سجل النقاط</Text>
        <Text style={styles.txHeaderCount}>{transactions.length} عملية</Text>
      </View>
    </View>
  );

  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="stars" size={56} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>لا توجد نقاط بعد</Text>
      <Text style={styles.emptyDesc}>
        قم بإتمام أول طلب لتحصل على {POINTS_PER_ORDER} نقطة!
      </Text>
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-white">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="card-giftcard" size={24} color="#fff" />
          <Text style={styles.headerTitle}>برنامج الولاء والنقاط</Text>
        </View>

        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransaction}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, paddingHorizontal: 16,
    backgroundColor: "#2563EB",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  listContent: { paddingBottom: 20 },

  // Points Card
  pointsCard: { paddingHorizontal: 16, paddingTop: 16 },
  pointsCardBg: {
    borderRadius: 20, overflow: "hidden",
    backgroundColor: "#1E3A5F",
  },
  pointsCardContent: { padding: 24, alignItems: "center" },
  pointsIconRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  pointsCardTitle: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  pointsValueRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  pointsValue: { fontSize: 52, fontWeight: "bold", color: "#FFD700" },
  pointsUnit: { fontSize: 20, fontWeight: "600", color: "#FFD700", opacity: 0.8 },
  pointsSubtext: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 12 },

  // Info Section
  infoSection: { paddingHorizontal: 16, paddingTop: 24 },
  infoTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937", marginBottom: 12, textAlign: "right" },
  infoCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  infoStep: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#2563EB",
    justifyContent: "center", alignItems: "center",
  },
  stepNumberText: { fontSize: 16, fontWeight: "bold", color: "#fff" },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: "bold", color: "#1F2937", textAlign: "right", marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "#6B7280", textAlign: "right", lineHeight: 20 },
  stepDivider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 14, marginLeft: 46 },

  // Draw Section
  drawSection: { paddingHorizontal: 16, paddingTop: 20 },
  drawCard: {
    backgroundColor: "#FFFBEB", borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  drawHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  drawTitle: { fontSize: 17, fontWeight: "bold", color: "#92400E" },
  drawDesc: { fontSize: 14, color: "#78350F", lineHeight: 22, textAlign: "right", marginBottom: 14 },
  drawHighlight: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#EFF6FF", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10,
  },
  drawHighlightText: { fontSize: 13, fontWeight: "600", color: "#2563EB", flex: 1, textAlign: "right" },

  // Transactions
  txHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12,
  },
  txHeaderTitle: { fontSize: 18, fontWeight: "bold", color: "#1F2937" },
  txHeaderCount: { fontSize: 13, color: "#6B7280" },
  txItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, paddingVertical: 14, paddingHorizontal: 16,
    backgroundColor: "#fff", borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#F3F4F6",
  },
  txIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center" },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: "600", color: "#1F2937", textAlign: "right" },
  txDate: { fontSize: 12, color: "#9CA3AF", marginTop: 4, textAlign: "right" },
  txPointsContainer: { alignItems: "center" },
  txPoints: { fontSize: 18, fontWeight: "bold", color: "#22C55E" },
  txPointsLabel: { fontSize: 11, color: "#6B7280" },

  // Empty
  emptyContainer: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "bold", color: "#9CA3AF" },
  emptyDesc: { fontSize: 14, color: "#D1D5DB", textAlign: "center", paddingHorizontal: 40 },
});
