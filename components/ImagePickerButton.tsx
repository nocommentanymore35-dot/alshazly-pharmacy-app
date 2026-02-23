import { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { trpc } from "@/lib/trpc";

interface ImagePickerButtonProps {
  currentImageUrl: string;
  onImageUploaded: (url: string) => void;
  label?: string;
}

export default function ImagePickerButton({ currentImageUrl, onImageUploaded, label }: ImagePickerButtonProps) {
  const [uploading, setUploading] = useState(false);
  const uploadMutation = trpc.upload.image.useMutation();

  const pickImage = async (useCamera: boolean) => {
    try {
      // Request permissions
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("تنبيه", "يجب السماح بالوصول إلى الكاميرا لالتقاط الصور");
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("تنبيه", "يجب السماح بالوصول إلى معرض الصور");
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("خطأ", "فشل في قراءة الصورة");
        return;
      }

      setUploading(true);

      // Determine file extension
      const uri = asset.uri;
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      const fileName = `img_${Date.now()}.${ext}`;

      // Upload to server
      const uploadResult = await uploadMutation.mutateAsync({
        base64: asset.base64,
        fileName,
        contentType,
      });

      if (uploadResult?.url) {
        onImageUploaded(uploadResult.url);
        Alert.alert("تم", "تم رفع الصورة بنجاح");
      } else {
        Alert.alert("خطأ", "فشل في رفع الصورة");
      }
    } catch (error: any) {
      console.error("Image pick/upload error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء رفع الصورة: " + (error.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const showOptions = () => {
    Alert.alert(
      "اختر مصدر الصورة",
      "",
      [
        { text: "📷 الكاميرا", onPress: () => pickImage(true) },
        { text: "🖼️ معرض الصور", onPress: () => pickImage(false) },
        { text: "إلغاء", style: "cancel" },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Preview */}
      {currentImageUrl ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: currentImageUrl }} style={styles.preview} contentFit="cover" />
          <Text style={styles.successText}>✓ تم رفع الصورة</Text>
        </View>
      ) : null}

      {/* Upload Button */}
      <Pressable
        onPress={showOptions}
        disabled={uploading}
        style={({ pressed }) => [styles.pickButton, pressed && { opacity: 0.8 }, uploading && { opacity: 0.6 }]}
      >
        {uploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.pickButtonText}>جاري الرفع...</Text>
          </View>
        ) : (
          <View style={styles.uploadingRow}>
            <MaterialIcons name="add-a-photo" size={20} color="#fff" />
            <Text style={styles.pickButtonText}>
              {currentImageUrl ? "تغيير الصورة" : "رفع صورة من الهاتف"}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
    textAlign: "right",
  },
  previewContainer: {
    alignItems: "center",
    marginBottom: 10,
  },
  preview: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  successText: {
    fontSize: 12,
    color: "#22C55E",
    marginTop: 4,
    fontWeight: "600",
  },
  pickButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  pickButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
