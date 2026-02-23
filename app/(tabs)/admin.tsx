import { useState, useEffect } from "react";
import {
  Text, View, TextInput, ScrollView, Alert, ActivityIndicator,
  FlatList, StyleSheet, Platform, Linking,
} from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { Pressable } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import ImagePickerButton from "@/components/ImagePickerButton";

type AdminTab = "orders" | "medicines" | "categories" | "banners" | "reports" | "customers" | "settings";

const STATUS_OPTIONS = [
  { key: "received", label: "تم الاستقبال" },
  { key: "preparing", label: "قيد التجهيز" },
  { key: "shipped", label: "تم الشحن" },
  { key: "delivered", label: "تم التسليم" },
];

export default function AdminScreen() {
  const { state, setAdminLoggedIn } = useAppStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [logging, setLogging] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");

  const loginMutation = trpc.admin.login.useMutation();
  const setupMutation = trpc.admin.setup.useMutation();

  useEffect(() => {
    setupMutation.mutate({ username: "admin", password: "admin123" });
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("خطأ", "يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }
    setLogging(true);
    try {
      const result = await loginMutation.mutateAsync({ username: username.trim(), password: password.trim() });
      if (result) {
        setAdminLoggedIn(true);
      } else {
        Alert.alert("خطأ", "اسم المستخدم أو كلمة المرور غير صحيحة");
      }
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ أثناء تسجيل الدخول");
    }
    setLogging(false);
  };

  if (!state.isAdminLoggedIn) {
    return (
      <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#2563EB]">
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>لوحة الإدارة</Text>
          </View>
          <View style={styles.loginContainer}>
            <MaterialIcons name="admin-panel-settings" size={64} color="#2563EB" />
            <Text style={styles.loginTitle}>تسجيل دخول الإدارة</Text>
            <Text style={styles.loginHint}>هذا القسم خاص بإدارة الصيدلية فقط</Text>

            <View style={styles.loginInput}>
              <MaterialIcons name="person" size={20} color="#6B7280" />
              <TextInput
                style={styles.loginField}
                placeholder="اسم المستخدم"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.loginInput}>
              <MaterialIcons name="lock" size={20} color="#6B7280" />
              <TextInput
                style={styles.loginField}
                placeholder="كلمة المرور"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color="#6B7280" />
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={logging}
              style={({ pressed }) => [styles.loginBtn, pressed && { opacity: 0.9 }]}
            >
              {logging ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.loginBtnText}>تسجيل الدخول</Text>
              )}
            </Pressable>

            <Text style={styles.contactText}>
              إذا واجهت أي صعوبة في استخدام التطبيق تواصل معنا عبر واتساب
            </Text>
            <Pressable onPress={() => Linking.openURL('https://wa.me/2001095071082')} style={{ marginTop: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialIcons name="chat" size={24} color="#fff" />
              </View>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]} containerClassName="bg-[#2563EB]">
      <View style={styles.container}>
        <View style={styles.headerCompact}>
          <Text style={styles.headerTitleCompact}>لوحة الإدارة</Text>
          <Pressable
            onPress={() => { setAdminLoggedIn(false); setUsername(""); setPassword(""); }}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.logoutText}>خروج</Text>
          </Pressable>
        </View>

        {/* Admin Tabs - Compact */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBarCompact} contentContainerStyle={{ paddingHorizontal: 8, gap: 4 }}>
          {[
            { key: "orders", label: "الطلبات", icon: "receipt-long" },
            { key: "medicines", label: "الأدوية", icon: "medication" },
            { key: "categories", label: "الفئات", icon: "category" },
            { key: "banners", label: "الإعلانات", icon: "campaign" },
            { key: "reports", label: "التقارير", icon: "bar-chart" },
            { key: "customers", label: "العملاء", icon: "people" },
            { key: "settings", label: "الإعدادات", icon: "settings" },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key as AdminTab)}
              style={({ pressed }) => [
                styles.tabItemCompact,
                activeTab === tab.key && styles.tabItemActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name={tab.icon as any} size={16} color={activeTab === tab.key ? "#2563EB" : "#6B7280"} />
              <Text style={[styles.tabLabelCompact, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.adminBody}>
          {activeTab === "orders" && <OrdersManagement />}
          {activeTab === "medicines" && <MedicinesManagement />}
          {activeTab === "categories" && <CategoriesManagement />}
          {activeTab === "banners" && <BannersManagement />}
          {activeTab === "reports" && <ReportsView />}
          {activeTab === "customers" && <CustomersManagement />}
          {activeTab === "settings" && <SettingsManagement />}
        </View>
      </View>
    </ScreenContainer>
  );
}

// ===== Orders Management =====
function OrdersManagement() {
  const ordersQuery = trpc.orders.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const updateStatusMutation = trpc.orders.updateStatus.useMutation();
  const deleteOrderMutation = trpc.orders.delete.useMutation();
  const orders = ordersQuery.data ?? [];

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await updateStatusMutation.mutateAsync({ id: orderId, status: newStatus as any });
      ordersQuery.refetch();
      Alert.alert("تم", "تم تحديث حالة الطلب");
    } catch (e) {
      Alert.alert("خطأ", "فشل تحديث الحالة");
    }
  };

  const handleDeleteOrder = (orderId: number) => {
    Alert.alert(
      "حذف الطلب",
      `هل أنت متأكد من حذف الطلب #${orderId}؟ \nلا يمكن التراجع عن هذا الإجراء.`,
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteOrderMutation.mutateAsync({ id: orderId });
              ordersQuery.refetch();
              Alert.alert("تم", "تم حذف الطلب بنجاح");
            } catch (e) {
              Alert.alert("خطأ", "فشل حذف الطلب");
            }
          },
        },
      ]
    );
  };

  if (ordersQuery.isLoading) return <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.adminSectionTitle}>الطلبات ({orders.length})</Text>
      {orders.length === 0 ? (
        <View style={styles.adminEmpty}>
          <MaterialIcons name="receipt-long" size={48} color="#D1D5DB" />
          <Text style={styles.adminEmptyText}>لا توجد طلبات</Text>
        </View>
      ) : (
        orders.map((order: any) => (
          <View key={order.id} style={styles.adminCard}>
            <View style={styles.adminCardHeader}>
              <Text style={styles.adminCardTitle}>طلب #{order.id}</Text>
              <Text style={styles.adminCardDate}>{new Date(order.createdAt).toLocaleDateString("ar-EG")}</Text>
            </View>
            <View style={styles.adminCardBody}>
              <Text style={styles.adminCardInfo}>العميل: {order.customerName}</Text>
              <Text style={styles.adminCardInfo}>الهاتف: {order.customerPhone}</Text>
              <Text style={styles.adminCardInfo}>العنوان: {order.customerAddress}</Text>
              <Text style={styles.adminCardInfo}>المبلغ: {parseFloat(order.totalAmount).toFixed(2)} ج.م</Text>
              <Text style={styles.adminCardInfo}>
                الدفع: {order.paymentMethod === "cash" ? "عند الاستلام" : "فودافون كاش"}
              </Text>
            </View>
            <View style={styles.statusButtons}>
              {STATUS_OPTIONS.map((s) => (
                <Pressable
                  key={s.key}
                  onPress={() => handleStatusChange(order.id, s.key)}
                  style={({ pressed }) => [
                    styles.statusBtn,
                    order.status === s.key && styles.statusBtnActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.statusBtnText, order.status === s.key && styles.statusBtnTextActive]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => handleDeleteOrder(order.id)}
              style={({ pressed }) => [
                styles.deleteOrderBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <MaterialIcons name="delete" size={18} color="#fff" />
              <Text style={styles.deleteOrderBtnText}>حذف الطلب</Text>
            </Pressable>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== Medicines Management =====
function MedicinesManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [strips, setStrips] = useState("1");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [descAr, setDescAr] = useState("");

  const medsQuery = trpc.medicines.listAll.useQuery();
  const catsQuery = trpc.categories.listAll.useQuery();
  const createMutation = trpc.medicines.create.useMutation();
  const updateMutation = trpc.medicines.update.useMutation();
  const deleteMutation = trpc.medicines.delete.useMutation();

  const meds = medsQuery.data ?? [];
  const cats = catsQuery.data ?? [];

  const resetForm = () => {
    setNameAr(""); setNameEn(""); setStrips("1"); setPrice(""); setDescAr("");
    setCategoryId(""); setStock(""); setImageUrl(""); setEditId(null); setShowForm(false);
  };

  const handleSave = async () => {
    if (!nameAr.trim() || !nameEn.trim() || !price.trim() || !categoryId) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول المطلوبة (الاسم عربي، الاسم إنجليزي، السعر، الفئة)");
      return;
    }
    try {
      if (editId) {
        await updateMutation.mutateAsync({
          id: editId, nameAr: nameAr.trim(), nameEn: nameEn.trim(),
          price: price.trim(), descriptionAr: descAr.trim(),
          categoryId: parseInt(categoryId), stock: parseInt(stock) || 0,
          strips: parseInt(strips) || 1,
          imageUrl: imageUrl.trim() || undefined,
        });
      } else {
        await createMutation.mutateAsync({
          nameAr: nameAr.trim(), nameEn: nameEn.trim(),
          price: price.trim(), descriptionAr: descAr.trim(),
          categoryId: parseInt(categoryId), stock: parseInt(stock) || 0,
          strips: parseInt(strips) || 1,
          imageUrl: imageUrl.trim() || undefined,
        });
      }
      medsQuery.refetch();
      resetForm();
      Alert.alert("تم", editId ? "تم تحديث الدواء" : "تم إضافة الدواء");
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ");
    }
  };

  const handleEdit = (med: any) => {
    setEditId(med.id);
    setNameAr(med.nameAr);
    setNameEn(med.nameEn);
    setPrice(med.price);
    setStrips(med.strips?.toString() ?? "1");
    setDescAr(med.descriptionAr ?? "");
    setCategoryId(med.categoryId.toString());
    setStock(med.stock?.toString() ?? "0");
    setImageUrl(med.imageUrl ?? "");
    setShowForm(true);
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("حذف", `هل تريد حذف "${name}"؟ سيتم حذفه نهائياً.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        await deleteMutation.mutateAsync({ id });
        medsQuery.refetch();
      }},
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.adminHeaderRow}>
        <Text style={styles.adminSectionTitle}>الأدوية ({meds.length})</Text>
        <Pressable
          onPress={() => { resetForm(); setShowForm(!showForm); }}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name={showForm ? "close" : "add"} size={20} color="#fff" />
          <Text style={styles.addBtnText}>{showForm ? "إلغاء" : "إضافة"}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formCardTitle}>{editId ? "تعديل دواء" : "إضافة دواء جديد"}</Text>
          <TextInput style={styles.formInput} placeholder="اسم الصنف (إنجليزي) *" value={nameEn} onChangeText={setNameEn} placeholderTextColor="#9CA3AF" />
          <TextInput style={styles.formInput} placeholder="اسم الصنف (عربي) *" value={nameAr} onChangeText={setNameAr} placeholderTextColor="#9CA3AF" />
          <TextInput style={styles.formInput} placeholder="عدد الشرائط" value={strips} onChangeText={setStrips} keyboardType="number-pad" placeholderTextColor="#9CA3AF" />
          <TextInput style={styles.formInput} placeholder="السعر (ج.م) *" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholderTextColor="#9CA3AF" />

          {/* Category Selector */}
          <Text style={styles.formLabel}>الفئة *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {cats.map((cat: any) => (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryId(cat.id.toString())}
                style={[styles.catChip, categoryId === cat.id.toString() && styles.catChipActive]}
              >
                <Text style={[styles.catChipText, categoryId === cat.id.toString() && styles.catChipTextActive]}>
                  {cat.nameAr}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput style={styles.formInput} placeholder="المخزون *" value={stock} onChangeText={setStock} keyboardType="number-pad" placeholderTextColor="#9CA3AF" />
          {/* Image Upload Section */}
          <ImagePickerButton
            currentImageUrl={imageUrl}
            onImageUploaded={(url) => setImageUrl(url)}
            label="صورة الصنف"
          />
          <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 8 }}>أو أدخل رابط صورة خارجي:</Text>
          <TextInput style={styles.formInput} placeholder="رابط صورة الصنف (URL) - اختياري" value={imageUrl} onChangeText={setImageUrl} placeholderTextColor="#9CA3AF" autoCapitalize="none" />
          {imageUrl.trim() && !imageUrl.startsWith('http') ? null : imageUrl.trim() ? (
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <Image source={{ uri: imageUrl.trim() }} style={{ width: 100, height: 100, borderRadius: 8 }} contentFit="cover" />
              <Text style={{ fontSize: 11, color: "#22C55E", marginTop: 4 }}>معاينة الصورة</Text>
            </View>
          ) : null}
          <TextInput style={[styles.formInput, { height: 60 }]} placeholder="الوصف (اختياري)" value={descAr} onChangeText={setDescAr} multiline placeholderTextColor="#9CA3AF" />

          <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveFormBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.saveFormBtnText}>{editId ? "تحديث" : "إضافة"}</Text>
          </Pressable>
        </View>
      )}

      {meds.map((med: any) => (
        <View key={med.id} style={styles.adminCard}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {med.imageUrl ? (
              <Image source={{ uri: med.imageUrl }} style={{ width: 50, height: 50, borderRadius: 8 }} contentFit="cover" />
            ) : (
              <View style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="medication" size={24} color="#D1D5DB" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.adminCardTitle}>{med.nameAr}</Text>
              <Text style={styles.adminCardSubtitle}>{med.nameEn}</Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>شرائط: {med.strips ?? 1} | مخزون: {med.stock}</Text>
            </View>
            <Text style={styles.medPrice}>{parseFloat(med.price).toFixed(2)} ج.م</Text>
          </View>
          <View style={styles.adminCardActions}>
            <Pressable onPress={() => handleEdit(med)} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="edit" size={18} color="#2563EB" />
              <Text style={styles.editBtnText}>تعديل</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(med.id, med.nameAr)} style={({ pressed }) => [styles.delBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="delete" size={18} color="#DC2626" />
              <Text style={styles.delBtnText}>حذف</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== Categories Management =====
function CategoriesManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const catsQuery = trpc.categories.listAll.useQuery();
  const createMutation = trpc.categories.create.useMutation();
  const updateMutation = trpc.categories.update.useMutation();
  const deleteMutation = trpc.categories.delete.useMutation();

  const cats = catsQuery.data ?? [];

  const resetForm = () => {
    setNameAr(""); setNameEn(""); setSortOrder("0"); setEditId(null); setShowForm(false);
  };

  const handleSave = async () => {
    if (!nameAr.trim() || !nameEn.trim()) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول");
      return;
    }
    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, nameAr: nameAr.trim(), nameEn: nameEn.trim(), sortOrder: parseInt(sortOrder) || 0 });
      } else {
        await createMutation.mutateAsync({ nameAr: nameAr.trim(), nameEn: nameEn.trim(), sortOrder: parseInt(sortOrder) || 0 });
      }
      catsQuery.refetch();
      resetForm();
      Alert.alert("تم", editId ? "تم تحديث الفئة" : "تم إضافة الفئة");
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ");
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("حذف", `هل تريد حذف فئة "${name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        await deleteMutation.mutateAsync({ id });
        catsQuery.refetch();
      }},
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.adminHeaderRow}>
        <Text style={styles.adminSectionTitle}>الفئات ({cats.length})</Text>
        <Pressable onPress={() => { resetForm(); setShowForm(!showForm); }} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}>
          <MaterialIcons name={showForm ? "close" : "add"} size={20} color="#fff" />
          <Text style={styles.addBtnText}>{showForm ? "إلغاء" : "إضافة"}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <TextInput style={styles.formInput} placeholder="اسم الفئة (عربي) *" value={nameAr} onChangeText={setNameAr} placeholderTextColor="#9CA3AF" />
          <TextInput style={styles.formInput} placeholder="اسم الفئة (إنجليزي) *" value={nameEn} onChangeText={setNameEn} placeholderTextColor="#9CA3AF" />
          <TextInput style={styles.formInput} placeholder="الترتيب" value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" placeholderTextColor="#9CA3AF" />
          <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveFormBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.saveFormBtnText}>{editId ? "تحديث" : "إضافة"}</Text>
          </Pressable>
        </View>
      )}

      {cats.map((cat: any) => (
        <View key={cat.id} style={styles.adminCard}>
          <View style={styles.adminCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminCardTitle}>{cat.nameAr}</Text>
              <Text style={styles.adminCardSubtitle}>{cat.nameEn}</Text>
            </View>
            <Text style={styles.adminCardDate}>ترتيب: {cat.sortOrder}</Text>
          </View>
          <View style={styles.adminCardActions}>
            <Pressable onPress={() => { setEditId(cat.id); setNameAr(cat.nameAr); setNameEn(cat.nameEn); setSortOrder(cat.sortOrder?.toString() ?? "0"); setShowForm(true); }} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="edit" size={18} color="#2563EB" />
              <Text style={styles.editBtnText}>تعديل</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(cat.id, cat.nameAr)} style={({ pressed }) => [styles.delBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="delete" size={18} color="#DC2626" />
              <Text style={styles.delBtnText}>حذف</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== Banners Management =====
function BannersManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const bannersQuery = trpc.banners.listAll.useQuery();
  const createMutation = trpc.banners.create.useMutation();
  const updateMutation = trpc.banners.update.useMutation();
  const deleteMutation = trpc.banners.delete.useMutation();

  const bannersList = bannersQuery.data ?? [];

  const resetForm = () => {
    setTitle(""); setDescription(""); setImageUrl(""); setSortOrder("0"); setEditId(null); setShowForm(false);
  };

  const handleSave = async () => {
    if (!imageUrl.trim()) {
      Alert.alert("خطأ", "يرجى إدخال رابط صورة الإعلان");
      return;
    }
    try {
      if (editId) {
        await updateMutation.mutateAsync({
          id: editId, title: title.trim(), description: description.trim(),
          imageUrl: imageUrl.trim() || undefined,
          sortOrder: parseInt(sortOrder) || 0,
        });
      } else {
        await createMutation.mutateAsync({
          title: title.trim() || undefined, description: description.trim() || undefined,
          imageUrl: imageUrl.trim(),
          sortOrder: parseInt(sortOrder) || 0,
        });
      }
      bannersQuery.refetch();
      resetForm();
      Alert.alert("تم", editId ? "تم تحديث الإعلان" : "تم إضافة الإعلان");
    } catch (e) {
      Alert.alert("خطأ", "حدث خطأ");
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("حذف", `هل تريد حذف إعلان "${name}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        await deleteMutation.mutateAsync({ id });
        bannersQuery.refetch();
      }},
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.adminHeaderRow}>
        <Text style={styles.adminSectionTitle}>الإعلانات ({bannersList.length})</Text>
        <Pressable onPress={() => { resetForm(); setShowForm(!showForm); }} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}>
          <MaterialIcons name={showForm ? "close" : "add"} size={20} color="#fff" />
          <Text style={styles.addBtnText}>{showForm ? "إلغاء" : "إضافة"}</Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formCardTitle}>{editId ? "تعديل إعلان" : "إضافة إعلان جديد"}</Text>
          <TextInput style={styles.formInput} placeholder="عنوان الإعلان (اختياري)" value={title} onChangeText={setTitle} placeholderTextColor="#9CA3AF" />
          <TextInput style={[styles.formInput, { height: 70 }]} placeholder="وصف الإعلان (اختياري)" value={description} onChangeText={setDescription} multiline placeholderTextColor="#9CA3AF" />
          {/* Image Upload Section */}
          <ImagePickerButton
            currentImageUrl={imageUrl}
            onImageUploaded={(url) => setImageUrl(url)}
            label="صورة الإعلان"
          />
          <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginBottom: 8 }}>أو أدخل رابط صورة خارجي:</Text>
          <TextInput style={styles.formInput} placeholder="رابط صورة الإعلان (URL) - اختياري" value={imageUrl} onChangeText={setImageUrl} placeholderTextColor="#9CA3AF" autoCapitalize="none" />
          {imageUrl.trim() ? (
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <Image source={{ uri: imageUrl.trim() }} style={{ width: "100%", height: 120, borderRadius: 8 }} contentFit="cover" />
              <Text style={{ fontSize: 11, color: "#22C55E", marginTop: 4 }}>معاينة صورة الإعلان</Text>
            </View>
          ) : null}
          <TextInput style={styles.formInput} placeholder="الترتيب (1, 2, 3...)" value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" placeholderTextColor="#9CA3AF" />
          <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveFormBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.saveFormBtnText}>{editId ? "تحديث" : "إضافة"}</Text>
          </Pressable>
        </View>
      )}

      {bannersList.map((banner: any) => (
        <View key={banner.id} style={styles.adminCard}>
          {banner.imageUrl ? (
            <Image source={{ uri: banner.imageUrl }} style={{ width: "100%", height: 100, borderRadius: 8, marginBottom: 8 }} contentFit="cover" />
          ) : null}
          <View style={styles.adminCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.adminCardTitle}>{banner.title}</Text>
              {banner.description && <Text style={styles.adminCardSubtitle} numberOfLines={2}>{banner.description}</Text>}
            </View>
            <Text style={styles.adminCardDate}>ترتيب: {banner.sortOrder}</Text>
          </View>
          <View style={styles.adminCardActions}>
            <Pressable onPress={() => { setEditId(banner.id); setTitle(banner.title); setDescription(banner.description ?? ""); setImageUrl(banner.imageUrl ?? ""); setSortOrder(banner.sortOrder?.toString() ?? "0"); setShowForm(true); }} style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="edit" size={18} color="#2563EB" />
              <Text style={styles.editBtnText}>تعديل</Text>
            </Pressable>
            <Pressable onPress={() => handleDelete(banner.id, banner.title)} style={({ pressed }) => [styles.delBtn, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="delete" size={18} color="#DC2626" />
              <Text style={styles.delBtnText}>حذف</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== Reports View =====
function ReportsView() {
  const reportsQuery = trpc.reports.sales.useQuery();
  const resetMutation = trpc.reports.reset.useMutation();
  const report = reportsQuery.data;

  const handleResetReport = () => {
    Alert.alert(
      "حذف تقرير المبيعات",
      "هل أنت متأكد من حذف تقرير المبيعات؟ \nسيتم حذف جميع الطلبات وإعادة تعيين التقارير من الصفر.\nلا يمكن التراجع عن هذا الإجراء.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "حذف",
          style: "destructive",
          onPress: async () => {
            try {
              await resetMutation.mutateAsync();
              reportsQuery.refetch();
              Alert.alert("تم", "تم حذف تقرير المبيعات بنجاح");
            } catch (e) {
              Alert.alert("خطأ", "فشل حذف التقرير");
            }
          },
        },
      ]
    );
  };

  if (reportsQuery.isLoading) return <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.adminSectionTitle}>تقارير المبيعات</Text>

      <View style={styles.reportGrid}>
        <View style={[styles.reportCard, { backgroundColor: "#EFF6FF" }]}>
          <MaterialIcons name="receipt-long" size={32} color="#2563EB" />
          <Text style={styles.reportValue}>{report?.totalOrders ?? 0}</Text>
          <Text style={styles.reportLabel}>إجمالي الطلبات</Text>
        </View>
        <View style={[styles.reportCard, { backgroundColor: "#F0FDF4" }]}>
          <MaterialIcons name="payments" size={32} color="#22C55E" />
          <Text style={styles.reportValue}>{parseFloat(report?.totalRevenue ?? "0").toFixed(2)}</Text>
          <Text style={styles.reportLabel}>الإيرادات (ج.م)</Text>
        </View>
      </View>

      <Text style={[styles.adminSectionTitle, { marginTop: 20 }]}>حسب الحالة</Text>
      {(report?.ordersByStatus ?? []).map((item: any) => {
        const statusLabel = STATUS_OPTIONS.find(s => s.key === item.status)?.label ?? item.status;
        return (
          <View key={item.status} style={styles.reportRow}>
            <Text style={styles.reportRowLabel}>{statusLabel}</Text>
            <View style={styles.reportRowValues}>
              <Text style={styles.reportRowCount}>{item.count} طلب</Text>
              <Text style={styles.reportRowRevenue}>{parseFloat(item.revenue).toFixed(2)} ج.م</Text>
            </View>
          </View>
        );
      })}
      <Pressable
        onPress={handleResetReport}
        style={({ pressed }) => [
          styles.resetReportBtn,
          pressed && { opacity: 0.8 },
        ]}
      >
        <MaterialIcons name="delete-sweep" size={22} color="#fff" />
        <Text style={styles.resetReportBtnText}>حذف تقرير المبيعات</Text>
      </Pressable>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== Customers Management =====
function CustomersManagement() {
  const customersQuery = trpc.customers.listAll.useQuery(undefined, { refetchInterval: 10000 });
  const approveCustomerMutation = trpc.customers.approve.useMutation();
  const toggleCustomerMutation = trpc.customers.toggleActive.useMutation();
  const deleteCustomerMutation = trpc.customers.delete.useMutation();
  const customers = customersQuery.data ?? [];

  const handleApprove = async (id: number) => {
    try {
      await approveCustomerMutation.mutateAsync({ id });
      customersQuery.refetch();
      Alert.alert("تم", "تم الموافقة على العميل");
    } catch (e) {
      Alert.alert("خطأ", "فشل الموافقة");
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await toggleCustomerMutation.mutateAsync({ id, isActive: !currentActive });
      customersQuery.refetch();
      Alert.alert("تم", currentActive ? "تم تعطيل العميل" : "تم تفعيل العميل");
    } catch (e) {
      Alert.alert("خطأ", "فشل التحديث");
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("حذف العميل", `هل أنت متأكد من حذف ${name}؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive",
        onPress: async () => {
          try {
            await deleteCustomerMutation.mutateAsync({ id });
            customersQuery.refetch();
            Alert.alert("تم", "تم حذف العميل");
          } catch (e) {
            Alert.alert("خطأ", "فشل الحذف");
          }
        },
      },
    ]);
  };

  if (customersQuery.isLoading) return <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.adminSectionTitle}>العملاء ({customers.length})</Text>
      {customers.length === 0 ? (
        <View style={styles.adminEmpty}>
          <MaterialIcons name="people" size={48} color="#D1D5DB" />
          <Text style={styles.adminEmptyText}>لا يوجد عملاء مسجلين</Text>
        </View>
      ) : (
        customers.map((c: any) => (
          <View key={c.id} style={[styles.adminCard, !c.isActive && { opacity: 0.6 }]}>
            <View style={styles.adminCardHeader}>
              <Text style={styles.adminCardTitle}>{c.fullName || 'بدون اسم'}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: c.status === 'approved' ? '#D1FAE5' : c.status === 'rejected' ? '#FEE2E2' : '#FEF3C7' }}>
                  <Text style={{ fontSize: 10, color: c.status === 'approved' ? '#065F46' : c.status === 'rejected' ? '#991B1B' : '#92400E' }}>
                    {c.status === 'approved' ? 'موافق' : c.status === 'rejected' ? 'مرفوض' : 'معلّق'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.adminCardBody}>
              <Text style={styles.adminCardInfo}>الهاتف: {c.phone || '-'}</Text>
              <Text style={styles.adminCardInfo}>العنوان: {c.address || '-'}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {c.status === 'pending' && (
                <Pressable onPress={() => handleApprove(c.id)} style={{ backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>موافقة</Text>
                </Pressable>
              )}
              <Pressable onPress={() => handleToggleActive(c.id, c.isActive !== false)} style={{ backgroundColor: c.isActive !== false ? '#F59E0B' : '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{c.isActive !== false ? 'تعطيل' : 'تفعيل'}</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(c.id, c.fullName || 'العميل')} style={{ backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>حذف</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ===== Settings Management =====
function SettingsManagement() {
  const changePasswordMutation = trpc.admin.changePassword.useMutation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert("خطأ", "يرجى ملء جميع الحقول");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("خطأ", "كلمة المرور الجديدة غير متطابقة");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("خطأ", "كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setChangingPassword(true);
    try {
      await changePasswordMutation.mutateAsync({
        username: 'admin',
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });
      Alert.alert("تم", "تم تغيير كلمة المرور بنجاح");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      Alert.alert("خطأ", "كلمة المرور الحالية غير صحيحة");
    }
    setChangingPassword(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.adminSectionTitle}>إعدادات التطبيق</Text>

      {/* Change Password */}
      <View style={[styles.adminCard, { marginTop: 12 }]}>
        <Text style={styles.adminCardTitle}>تغيير كلمة المرور</Text>
        <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 12, textAlign: 'right' }}>
          قم بتغيير كلمة مرور لوحة الإدارة
        </Text>
        <TextInput
          style={styles.formInput}
          placeholder="كلمة المرور الحالية"
          placeholderTextColor="#9CA3AF"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.formInput}
          placeholder="كلمة المرور الجديدة"
          placeholderTextColor="#9CA3AF"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.formInput}
          placeholder="تأكيد كلمة المرور الجديدة"
          placeholderTextColor="#9CA3AF"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <Pressable
          onPress={handleChangePassword}
          disabled={changingPassword}
          style={({ pressed }) => [{
            backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 12,
            alignItems: 'center', marginTop: 4, opacity: changingPassword ? 0.6 : 1,
          }, pressed && { opacity: 0.8 }]}
        >
          {changingPassword ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>تغيير كلمة المرور</Text>
          )}
        </Pressable>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    backgroundColor: "#2563EB", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerCompact: {
    backgroundColor: "#2563EB", paddingHorizontal: 16, paddingTop: 44, paddingBottom: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "bold", color: "#fff" },
  headerTitleCompact: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  logoutText: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  // Login
  loginContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, backgroundColor: "#fff" },
  loginTitle: { fontSize: 22, fontWeight: "bold", color: "#1F2937", marginTop: 16 },
  loginHint: { fontSize: 14, color: "#6B7280", marginTop: 8, marginBottom: 24 },
  loginInput: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB",
    borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 12, height: 48, width: "100%", marginBottom: 12,
  },
  loginField: { flex: 1, fontSize: 15, color: "#1F2937", textAlign: "right", marginHorizontal: 8 },
  loginBtn: {
    backgroundColor: "#2563EB", borderRadius: 12, paddingVertical: 14,
    width: "100%", alignItems: "center", marginTop: 8,
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  contactText: { fontSize: 12, color: "#9CA3AF", marginTop: 20, textAlign: "center" },
  // Tabs - Compact
  tabsBarCompact: { backgroundColor: "#fff", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tabItemCompact: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  tabItemActive: { backgroundColor: "#EFF6FF" },
  tabLabelCompact: { fontSize: 11, color: "#6B7280", fontWeight: "600" },
  tabLabelActive: { color: "#2563EB" },
  adminBody: { flex: 1, padding: 12 },
  adminSectionTitle: { fontSize: 16, fontWeight: "bold", color: "#1F2937", marginBottom: 10, textAlign: "right" },
  adminHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#2563EB", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  adminEmpty: { alignItems: "center", paddingVertical: 40 },
  adminEmptyText: { fontSize: 15, color: "#6B7280", marginTop: 12 },
  adminCard: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10,
  },
  adminCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  adminCardTitle: { fontSize: 14, fontWeight: "bold", color: "#1F2937", textAlign: "right" },
  adminCardSubtitle: { fontSize: 11, color: "#6B7280", textAlign: "right", marginTop: 2 },
  adminCardDate: { fontSize: 11, color: "#9CA3AF" },
  adminCardBody: { gap: 3, marginBottom: 6 },
  adminCardInfo: { fontSize: 12, color: "#4B5563", textAlign: "right" },
  adminCardActions: { flexDirection: "row", gap: 12, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 6 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  editBtnText: { fontSize: 12, color: "#2563EB", fontWeight: "600" },
  delBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  delBtnText: { fontSize: 12, color: "#DC2626", fontWeight: "600" },
  medPrice: { fontSize: 14, fontWeight: "bold", color: "#2563EB" },
  statusButtons: { flexDirection: "row", flexWrap: "wrap", gap: 5, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 6 },
  statusBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  statusBtnActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  statusBtnText: { fontSize: 10, color: "#6B7280", fontWeight: "600" },
  statusBtnTextActive: { color: "#fff" },
  // Form
  formCard: {
    backgroundColor: "#fff", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 14,
  },
  formCardTitle: { fontSize: 15, fontWeight: "bold", color: "#1F2937", marginBottom: 10, textAlign: "right" },
  formInput: {
    backgroundColor: "#F9FAFB", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB",
    paddingHorizontal: 12, height: 42, fontSize: 13, color: "#1F2937",
    textAlign: "right", marginBottom: 8,
  },
  formLabel: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 4, textAlign: "right" },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, borderColor: "#E5E7EB", marginRight: 6,
  },
  catChipActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  catChipText: { fontSize: 12, color: "#6B7280" },
  catChipTextActive: { color: "#fff" },
  saveFormBtn: {
    backgroundColor: "#2563EB", borderRadius: 8, paddingVertical: 10,
    alignItems: "center", marginTop: 4,
  },
  saveFormBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  // Reports
  reportGrid: { flexDirection: "row", gap: 10 },
  reportCard: {
    flex: 1, borderRadius: 10, padding: 14, alignItems: "center",
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  reportValue: { fontSize: 22, fontWeight: "bold", color: "#1F2937", marginTop: 6 },
  reportLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  reportRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 6,
  },
  reportRowLabel: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  reportRowValues: { alignItems: "flex-end" },
  reportRowCount: { fontSize: 13, fontWeight: "bold", color: "#2563EB" },
  reportRowRevenue: { fontSize: 11, color: "#6B7280" },
  deleteOrderBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#EF4444", borderRadius: 8, paddingVertical: 10,
    marginTop: 10, gap: 6,
  },
  deleteOrderBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  resetReportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#EF4444", borderRadius: 10, paddingVertical: 14,
    marginTop: 24, gap: 8,
  },
  resetReportBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
