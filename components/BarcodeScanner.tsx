/**
 * Barcode Scanner Component
 * 
 * Supports two modes:
 * 1. Camera scanning using expo-camera CameraView
 * 2. Manual text input (supports numbers and letters)
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, StyleSheet, Modal, Pressable,
  ActivityIndicator, Alert, Platform, Dimensions, Keyboard,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (barcode: string) => void;
  loading?: boolean;
}

export default function BarcodeScanner({ visible, onClose, onBarcodeScanned, loading }: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState("");
  const [mode, setMode] = useState<"manual" | "camera">("manual");
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setBarcode("");
      setScanned(false);
      setMode("manual");
      setTimeout(() => {
        inputRef.current?.focus();
      }, 400);
    }
  }, [visible]);

  const handleSubmit = () => {
    const trimmed = barcode.trim();
    if (!trimmed) {
      Alert.alert("تنبيه", "يرجى إدخال رقم الباركود");
      return;
    }
    Keyboard.dismiss();
    onBarcodeScanned(trimmed);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || loading) return;
    setScanned(true);
    setBarcode(data);
    onBarcodeScanned(data);
  };

  const switchToCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "إذن الكاميرا مطلوب",
          "يرجى السماح للتطبيق باستخدام الكاميرا لمسح الباركود",
          [{ text: "حسناً" }]
        );
        return;
      }
    }
    setScanned(false);
    setMode("camera");
  };

  const switchToManual = () => {
    setMode("manual");
    setScanned(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
        <Pressable style={styles.overlayTouch} onPress={onClose} />
        
        <Animated.View entering={SlideInDown.duration(400).springify()} style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#6B7280" />
            </Pressable>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>البحث بالباركود</Text>
              <MaterialIcons name="qr-code-scanner" size={24} color="#2563EB" />
            </View>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <Pressable
              onPress={switchToManual}
              style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]}
            >
              <MaterialIcons name="keyboard" size={18} color={mode === "manual" ? "#fff" : "#6B7280"} />
              <Text style={[styles.modeBtnText, mode === "manual" && styles.modeBtnTextActive]}>إدخال يدوي</Text>
            </Pressable>
            <Pressable
              onPress={switchToCamera}
              style={[styles.modeBtn, mode === "camera" && styles.modeBtnActive]}
            >
              <MaterialIcons name="camera-alt" size={18} color={mode === "camera" ? "#fff" : "#6B7280"} />
              <Text style={[styles.modeBtnText, mode === "camera" && styles.modeBtnTextActive]}>مسح بالكاميرا</Text>
            </Pressable>
          </View>

          {mode === "camera" ? (
            /* Camera Mode */
            <View style={styles.cameraSection}>
              <View style={styles.cameraContainer}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: [
                      "ean13", "ean8", "upc_a", "upc_e",
                      "code128", "code39", "code93",
                      "itf14", "codabar", "datamatrix",
                      "qr", "pdf417", "aztec",
                    ],
                  }}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
                {/* Scanner overlay frame */}
                <View style={styles.scanOverlay}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />
                  </View>
                </View>
              </View>
              <Text style={styles.cameraHint}>
                {scanned ? "تم مسح الباركود! جاري البحث..." : "وجّه الكاميرا نحو الباركود"}
              </Text>
              {scanned && (
                <Pressable onPress={() => setScanned(false)} style={styles.rescanBtn}>
                  <MaterialIcons name="refresh" size={18} color="#2563EB" />
                  <Text style={styles.rescanBtnText}>مسح مرة أخرى</Text>
                </Pressable>
              )}
              {loading && <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 12 }} />}
            </View>
          ) : (
            /* Manual Input Mode */
            <>
              {/* Scanner Illustration */}
              <View style={styles.illustrationContainer}>
                <View style={styles.scannerFrame}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                  <MaterialIcons name="qr-code-scanner" size={64} color="#2563EB" />
                </View>
                <Text style={styles.illustrationText}>
                  أدخل رقم الباركود الموجود على عبوة الدواء
                </Text>
              </View>

              {/* Barcode Input - accepts any text */}
              <View style={styles.inputSection}>
                <View style={styles.inputContainer}>
                  <Pressable onPress={handleSubmit} style={styles.searchIconBtn}>
                    <MaterialIcons name="search" size={22} color="#2563EB" />
                  </Pressable>
                  <TextInput
                    ref={inputRef}
                    style={styles.input}
                    placeholder="أدخل الباركود (أرقام أو حروف)..."
                    placeholderTextColor="#9CA3AF"
                    value={barcode}
                    onChangeText={setBarcode}
                    keyboardType="default"
                    returnKeyType="search"
                    onSubmitEditing={handleSubmit}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <MaterialIcons name="qr-code" size={22} color="#6B7280" style={{ marginLeft: 8 }} />
                </View>

                {/* Search Button */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={loading || !barcode.trim()}
                  style={({ pressed }) => [
                    styles.searchBtn,
                    (!barcode.trim() || loading) && styles.searchBtnDisabled,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.searchBtnText}>بحث</Text>
                      <MaterialIcons name="search" size={20} color="#fff" />
                    </>
                  )}
                </Pressable>
              </View>

              {/* Tips */}
              <View style={styles.tipsContainer}>
                <View style={styles.tipRow}>
                  <Text style={styles.tipText}>يمكنك إدخال الباركود يدوياً أو مسحه بالكاميرا</Text>
                  <MaterialIcons name="info-outline" size={16} color="#9CA3AF" />
                </View>
                <View style={styles.tipRow}>
                  <Text style={styles.tipText}>الباركود يقبل أرقام وحروف</Text>
                  <MaterialIcons name="abc" size={16} color="#9CA3AF" />
                </View>
              </View>
            </>
          )}

          <View style={{ height: 20 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  overlayTouch: {
    flex: 1,
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1F2937",
  },
  closeBtn: {
    padding: 4,
  },
  modeToggle: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  modeBtnActive: {
    backgroundColor: "#2563EB",
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  modeBtnTextActive: {
    color: "#fff",
  },
  // Camera styles
  cameraSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  cameraContainer: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    maxWidth: 300,
    maxHeight: 300,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanFrame: {
    width: 200,
    height: 200,
    position: "relative",
  },
  cameraHint: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
    textAlign: "center",
  },
  rescanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
  },
  rescanBtnText: {
    fontSize: 14,
    color: "#2563EB",
    fontWeight: "600",
  },
  // Manual input styles
  illustrationContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  scannerFrame: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#2563EB",
  },
  topLeft: {
    top: 0, left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0, right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0, left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0, right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  illustrationText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 16,
    textAlign: "center",
  },
  inputSection: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
    textAlign: "right",
    marginHorizontal: 8,
  },
  searchIconBtn: {
    padding: 4,
  },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
  },
  searchBtnDisabled: {
    backgroundColor: "#93C5FD",
  },
  searchBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  tipsContainer: {
    marginTop: 16,
    gap: 8,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  tipText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
});
