import { useState } from "react";
import { Text, View, ScrollView, FlatList, StyleSheet, Platform, Share, Alert } from "react-native";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore } from "@/lib/store";

export default function LoyaltyScreen() {
  const { state } = useAppStore();
  const totalPoints = state.loyaltyPoints ?? 0;
  const history = state.pointsHistory ?? [];

  const handleShareApp = async () => {
    try {
      const message = `🏥 جرّب تطبيق صيدلية الشاذلي!\n\nاطلب أدويتك بسهولة من هاتفك مع خدمة التوصيل.\nاجمع نقاط الولاء مع كل طلب وادخل السحب السنوي على جوائز قيّمة!\n\nحمّل التطبيق الآن 📲`;
      
      if (Platform.OS === "web") {
        if (navigator.share) {
          await navigator.share({ title: "صيدلية الشاذلي", text: message });
        } else {
          await navigator.clipboard.writeText(message);
          Alert.alert("تم النسخ ✅", "تم نسخ رسالة المشاركة. يمكنك لصقها وإرسالها لأصدقائك.");
        }
      } else {
        await Share.share({
          message: message,
          title: "صيدلية الشاذلي",
        });
      }
    } catch (e) {
      // User cancelled sharing
    }
  };

  return (
    <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#4169E1]">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <MaterialIcons name="card-giftcard" size={28} color="#FFD700" />
          <Text style={styles.headerTitle}>برنامج الولاء</Text>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Points Card */}
          <View style={styles.pointsCard}>
            <View style={styles.pointsCardInner}>
              <MaterialIcons name="stars" size={48} color="#FFD700" />
              <Text style={styles.pointsLabel}>رصيد نقاطك</Text>
              <Text style={styles.pointsValue}>{totalPoints}</Text>
              <Text style={styles.pointsUnit}>نقطة</Text>
            </View>
            <View style={styles.pointsCardFooter}>
              <MaterialIcons name="info-outline" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={styles.pointsFooterText}>كل 1 جنيه = 1 نقطة</Text>
            </View>
          </View>

          {/* How it works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>كيف يعمل البرنامج؟</Text>
            
            <View style={styles.stepCard}>
              <View style={[styles.stepIcon, { backgroundColor: "#EBF5FF" }]}>
                <MaterialIcons name="shopping-cart" size={24} color="#4169E1" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>1. اطلب أدويتك</Text>
                <Text style={styles.stepDesc}>قم بطلب أدويتك من التطبيق كالمعتاد</Text>
              </View>
            </View>

            <View style={styles.stepCard}>
              <View style={[styles.stepIcon, { backgroundColor: "#FFF7E6" }]}>
                <MaterialIcons name="stars" size={24} color="#F59E0B" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>2. اجمع النقاط</Text>
                <Text style={styles.stepDesc}>احصل على نقطة واحدة مقابل كل جنيه تصرفه</Text>
              </View>
            </View>

            <View style={styles.stepCard}>
              <View style={[styles.stepIcon, { backgroundColor: "#F0FDF4" }]}>
                <MaterialIcons name="emoji-events" size={24} color="#22C55E" />
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>3. ادخل السحب السنوي</Text>
                <Text style={styles.stepDesc}>في نهاية كل عام، يدخل جميع العملاء سحباً عشوائياً للفوز بجائزة قيّمة!</Text>
              </View>
            </View>
          </View>

          {/* Annual Draw Info */}
          <View style={styles.drawCard}>
            <View style={styles.drawHeader}>
              <MaterialIcons name="emoji-events" size={32} color="#FFD700" />
              <Text style={styles.drawTitle}>السحب العشوائي السنوي</Text>
            </View>
            <Text style={styles.drawDesc}>
              في نهاية كل عام، يتم إجراء سحب عشوائي بين جميع العملاء الذين جمعوا نقاطاً خلال العام. كلما زادت نقاطك، زادت فرصتك في الفوز!
            </Text>
            <View style={styles.drawBadge}>
              <MaterialIcons name="verified" size={18} color="#4169E1" />
              <Text style={styles.drawBadgeText}>أنت مشترك تلقائياً في السحب</Text>
            </View>
          </View>

          {/* Share App Button */}
          <View style={styles.shareSection}>
            <Text style={styles.shareSectionTitle}>شارك التطبيق</Text>
            <Text style={styles.shareSectionDesc}>ادعُ أصدقاءك لاستخدام التطبيق والاستفادة من خدماتنا</Text>
            <Pressable
              onPress={handleShareApp}
              style={({ pressed }) => [
                styles.shareBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
              ]}
            >
              <MaterialIcons name="share" size={22} color="#fff" />
              <Text style={styles.shareBtnText}>مشاركة التطبيق مع الأصدقاء</Text>
            </Pressable>
          </View>

          {/* Points History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>سجل النقاط</Text>
            {history.length === 0 ? (
              <View style={styles.emptyHistory}>
                <MaterialIcons name="receipt-long" size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>لا توجد نقاط مكتسبة بعد</Text>
                <Text style={styles.emptySubText}>ابدأ بطلب أدويتك لكسب النقاط</Text>
              </View>
            ) : (
              history.slice(0, 20).map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={styles.historyIcon}>
                      <MaterialIcons name="add-circle" size={20} color="#22C55E" />
                    </View>
                    <View>
                      <Text style={styles.historyReason}>{entry.reason}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(entry.date).toLocaleDateString("ar-EG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyPoints}>+{entry.amount}</Text>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: {
    backgroundColor: "#4169E1",
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    alignItems: "center",
    flexDirection: "row-reverse",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  body: { flex: 1 },

  // Points Card
  pointsCard: {
    margin: 16,
    borderRadius: 20,
    backgroundColor: "#4169E1",
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pointsCardInner: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  pointsLabel: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
  },
  pointsValue: {
    fontSize: 56,
    fontWeight: "bold",
    color: "#FFD700",
    marginTop: 4,
  },
  pointsUnit: {
    fontSize: 18,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "600",
  },
  pointsCardFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingVertical: 10,
  },
  pointsFooterText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
  },

  // Section
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "right",
    marginBottom: 12,
  },

  // Steps
  stepCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  stepContent: { flex: 1 },
  stepTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "right",
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "right",
    lineHeight: 20,
  },

  // Draw Card
  drawCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  drawHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  drawTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#92400E",
  },
  drawDesc: {
    fontSize: 14,
    color: "#78350F",
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 12,
  },
  drawBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-end",
  },
  drawBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4169E1",
  },

  // Share Section
  shareSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  shareSectionTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 6,
  },
  shareSectionDesc: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  shareBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    width: "100%",
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },

  // History
  emptyHistory: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#9CA3AF",
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 13,
    color: "#D1D5DB",
    marginTop: 4,
  },
  historyItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  historyLeft: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  historyReason: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "right",
  },
  historyDate: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 2,
  },
  historyPoints: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#22C55E",
    marginRight: 8,
  },
});
