import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { trpc } from "@/lib/trpc";

// ─── Types ───────────────────────────────────────────────────────────
type VoiceSearchState =
  | "idle"
  | "listening"
  | "processing"
  | "success"
  | "error";

interface VoiceSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}

// ─── Animated Sound Wave Bar ─────────────────────────────────────────
const WaveBar = ({ index, isActive }: { index: number; isActive: boolean }) => {
  const height = useSharedValue(8);

  useEffect(() => {
    if (isActive) {
      const randomDuration = 300 + Math.random() * 400;
      const randomHeight = 15 + Math.random() * 35;
      height.value = withRepeat(
        withSequence(
          withDelay(
            index * 80,
            withTiming(randomHeight, {
              duration: randomDuration,
              easing: Easing.inOut(Easing.ease),
            })
          ),
          withTiming(8 + Math.random() * 10, {
            duration: randomDuration,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(8, { duration: 300 });
    }
  }, [isActive]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.waveBar,
        animStyle,
        { backgroundColor: isActive ? "#2563EB" : "#D1D5DB" },
      ]}
    />
  );
};

// ─── Pulsing Ring Animation ──────────────────────────────────────────
const PulsingRing = ({ isActive, delay = 0 }: { isActive: boolean; delay?: number }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      scale.value = withDelay(
        delay,
        withRepeat(
          withTiming(2.2, { duration: 1500, easing: Easing.out(Easing.ease) }),
          -1,
          false
        )
      );
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(delay > 0 ? 0.3 : 0.4, { duration: 100 }),
            withTiming(0, { duration: 1400, easing: Easing.out(Easing.ease) })
          ),
          -1,
          false
        )
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [isActive]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.pulsingRing,
        delay > 0 && styles.pulsingRing2,
        ringStyle,
      ]}
    />
  );
};

// ─── Timer Display ───────────────────────────────────────────────────
const TimerDisplay = ({ seconds }: { seconds: number }) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <Text style={styles.timerText}>
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </Text>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
export default function VoiceSearchModal({
  visible,
  onClose,
  onResult,
}: VoiceSearchModalProps) {
  const [state, setState] = useState<VoiceSearchState>("idle");
  const [timer, setTimer] = useState(0);
  const [resultText, setResultText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<any>(null);
  const webRecognitionRef = useRef<any>(null);
  const stateRef = useRef<VoiceSearchState>("idle");
  const resultTextRef = useRef("");

  // Keep refs in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    resultTextRef.current = resultText;
  }, [resultText]);

  // Mic button animation
  const micScale = useSharedValue(1);
  const micBgOpacity = useSharedValue(0);

  // Upload mutation
  const uploadMutation = trpc.upload.image.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();

  // Cleanup on unmount or close
  useEffect(() => {
    if (!visible) {
      cleanup();
      setState("idle");
      setTimer(0);
      setResultText("");
      setErrorMessage("");
    }
  }, [visible]);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (webRecognitionRef.current) {
      try {
        webRecognitionRef.current.stop();
      } catch (_e) {}
      webRecognitionRef.current = null;
    }
    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch (_e) {}
      recorderRef.current = null;
    }
    cancelAnimation(micScale);
    cancelAnimation(micBgOpacity);
    micScale.value = withTiming(1, { duration: 200 });
    micBgOpacity.value = withTiming(0, { duration: 200 });
  }, []);

  // Start timer
  const startTimer = useCallback(() => {
    setTimer(0);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev >= 59) {
          // Auto-stop after 60 seconds
          handleStopListening();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, []);

  // Stop timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Start mic animation
  const startMicAnimation = useCallback(() => {
    micScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    micBgOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  // Stop mic animation
  const stopMicAnimation = useCallback(() => {
    cancelAnimation(micScale);
    cancelAnimation(micBgOpacity);
    micScale.value = withTiming(1, { duration: 200 });
    micBgOpacity.value = withTiming(0, { duration: 200 });
  }, []);

  // ─── Web Speech API ────────────────────────────────────────────────
  const startWebSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState("error");
      setErrorMessage("المتصفح لا يدعم التعرف على الكلام");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-EG";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const displayText = finalTranscript || interimTranscript;
      if (displayText.trim()) {
        setResultText(displayText.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      stopTimer();
      stopMicAnimation();
      if (event.error === "no-speech") {
        setState("error");
        setErrorMessage(
          "لم يتم التقاط أي صوت. تأكد من الميكروفون وحاول مرة أخرى."
        );
      } else if (event.error === "not-allowed") {
        setState("error");
        setErrorMessage(
          "يجب السماح بالوصول إلى الميكروفون لاستخدام البحث الصوتي."
        );
      } else {
        setState("error");
        setErrorMessage("حدث خطأ أثناء التعرف على الكلام. حاول مرة أخرى.");
      }
    };

    recognition.onend = () => {
      // If we're still in listening state, it means recognition ended naturally
      if (stateRef.current === "listening") {
        stopTimer();
        stopMicAnimation();
        if (resultTextRef.current.trim()) {
          setState("success");
        } else {
          setState("idle");
        }
      }
    };

    webRecognitionRef.current = recognition;
    recognition.start();
    setState("listening");
    startTimer();
    startMicAnimation();
  }, []);

  // ─── Native Recording (expo-audio) ────────────────────────────────
  const startNativeRecording = useCallback(async () => {
    try {
      const {
        requestRecordingPermissionsAsync,
        setAudioModeAsync,
        useAudioRecorder,
        RecordingPresets,
        AudioModule,
      } = await import("expo-audio");

      const permStatus = await requestRecordingPermissionsAsync();

      if (!permStatus.granted) {
        setState("error");
        setErrorMessage(
          "يجب السماح بالوصول إلى الميكروفون لاستخدام البحث الصوتي."
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Create recorder using AudioRecorder class from AudioModule
      const recorder = new AudioModule.AudioRecorder(
        RecordingPresets.HIGH_QUALITY
      );
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record();
      recorderRef.current = recorder;

      setState("listening");
      startTimer();
      startMicAnimation();
    } catch (error: any) {
      console.error("Recording error:", error);
      setState("error");
      setErrorMessage("حدث خطأ أثناء بدء التسجيل. حاول مرة أخرى.");
    }
  }, []);

  // ─── Stop Native Recording & Transcribe ───────────────────────────
  const stopNativeRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    stopTimer();
    stopMicAnimation();
    setState("processing");

    try {
      const recorder = recorderRef.current;
      await recorder.stop();
      const uri = recorder.uri;
      recorderRef.current = null;

      if (!uri) {
        setState("error");
        setErrorMessage("لم يتم حفظ التسجيل الصوتي.");
        return;
      }

      // Read the audio file and convert to base64
      const response = await fetch(uri);
      const blob = await response.blob();

      // Convert blob to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1] || result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Upload audio to server storage
      const uploadResult = await uploadMutation.mutateAsync({
        base64,
        fileName: `voice-search-${Date.now()}.m4a`,
        contentType: "audio/m4a",
      });

      // Transcribe the audio
      const transcribeResult = await transcribeMutation.mutateAsync({
        audioUrl: uploadResult.url,
      });

      if (transcribeResult.text && transcribeResult.text.trim().length > 0) {
        setResultText(transcribeResult.text.trim());
        setState("success");
      } else {
        setState("error");
        setErrorMessage("لم يتم التعرف على كلام. حاول التحدث بوضوح أكثر.");
      }
    } catch (error: any) {
      console.error("Transcription error:", error);
      setState("error");
      setErrorMessage("حدث خطأ أثناء تحويل الصوت إلى نص. حاول مرة أخرى.");
    }
  }, []);

  // ─── Start Listening ───────────────────────────────────────────────
  const startListening = useCallback(() => {
    setResultText("");
    setErrorMessage("");

    if (Platform.OS === "web") {
      startWebSpeechRecognition();
    } else {
      startNativeRecording();
    }
  }, [startWebSpeechRecognition, startNativeRecording]);

  // ─── Stop Listening (stable ref for timer) ─────────────────────────
  const handleStopListening = useCallback(() => {
    stopTimer();
    stopMicAnimation();

    if (Platform.OS === "web") {
      if (webRecognitionRef.current) {
        webRecognitionRef.current.stop();
        webRecognitionRef.current = null;
      }
      if (resultTextRef.current.trim()) {
        setState("success");
      } else {
        setState("idle");
      }
    } else {
      stopNativeRecording();
    }
  }, [stopNativeRecording]);

  // ─── Handle Use Result ─────────────────────────────────────────────
  const handleUseResult = useCallback(() => {
    if (resultText.trim()) {
      onResult(resultText.trim());
      onClose();
    }
  }, [resultText, onResult, onClose]);

  // ─── Handle Retry ──────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setState("idle");
    setResultText("");
    setErrorMessage("");
    setTimer(0);
  }, []);

  // ─── Animated Styles ───────────────────────────────────────────────
  const micButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
  }));

  const micBgStyle = useAnimatedStyle(() => ({
    opacity: micBgOpacity.value,
  }));

  // ─── Auto-start on open ───────────────────────────────────────────
  useEffect(() => {
    if (visible && state === "idle") {
      // Small delay for modal animation
      const timeout = setTimeout(() => {
        startListening();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <Pressable
            onPress={() => {
              cleanup();
              onClose();
            }}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <MaterialIcons name="close" size={24} color="#6B7280" />
          </Pressable>

          {/* Title */}
          <Text style={styles.title}>البحث الصوتي</Text>
          <Text style={styles.subtitle}>
            {state === "idle" && "اضغط على الميكروفون للبدء"}
            {state === "listening" && "جارٍ الاستماع... تحدث الآن"}
            {state === "processing" && "جارٍ تحويل الصوت إلى نص..."}
            {state === "success" && "تم التعرف على النص بنجاح"}
            {state === "error" && "حدث خطأ"}
          </Text>

          {/* Main Content Area */}
          <View style={styles.contentArea}>
            {/* Sound Wave Visualization */}
            {(state === "listening" || state === "idle") && (
              <View style={styles.waveContainer}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <WaveBar
                    key={i}
                    index={i}
                    isActive={state === "listening"}
                  />
                ))}
              </View>
            )}

            {/* Processing Spinner */}
            {state === "processing" && (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={styles.processingText}>
                  جارٍ معالجة الصوت...
                </Text>
              </View>
            )}

            {/* Success Result */}
            {state === "success" && (
              <View style={styles.resultContainer}>
                <View style={styles.resultIconContainer}>
                  <MaterialIcons
                    name="check-circle"
                    size={48}
                    color="#16A34A"
                  />
                </View>
                <Text style={styles.resultLabel}>نتيجة البحث:</Text>
                <View style={styles.resultTextBox}>
                  <Text style={styles.resultTextContent}>{resultText}</Text>
                </View>
              </View>
            )}

            {/* Error State */}
            {state === "error" && (
              <View style={styles.errorContainer}>
                <MaterialIcons
                  name="error-outline"
                  size={48}
                  color="#DC2626"
                />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Interim Result (while listening on web) */}
            {state === "listening" && resultText.length > 0 && (
              <View style={styles.interimContainer}>
                <Text style={styles.interimText}>{resultText}</Text>
              </View>
            )}
          </View>

          {/* Timer */}
          {(state === "listening" || state === "idle") && (
            <TimerDisplay seconds={timer} />
          )}

          {/* Mic Button */}
          <View style={styles.micButtonContainer}>
            <PulsingRing isActive={state === "listening"} />
            <PulsingRing isActive={state === "listening"} delay={500} />

            <Animated.View style={[styles.micButtonBg, micBgStyle]} />

            {state === "idle" && (
              <Pressable
                onPress={startListening}
                style={({ pressed }) => [
                  styles.micButton,
                  styles.micButtonIdle,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
              >
                <MaterialIcons name="mic" size={36} color="#fff" />
              </Pressable>
            )}

            {state === "listening" && (
              <Pressable
                onPress={handleStopListening}
                style={({ pressed }) => [pressed && { opacity: 0.8 }]}
              >
                <Animated.View
                  style={[
                    styles.micButton,
                    styles.micButtonActive,
                    micButtonStyle,
                  ]}
                >
                  <MaterialIcons name="stop" size={36} color="#fff" />
                </Animated.View>
              </Pressable>
            )}

            {state === "processing" && (
              <View style={[styles.micButton, styles.micButtonProcessing]}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}

            {state === "success" && (
              <Pressable
                onPress={handleUseResult}
                style={({ pressed }) => [
                  styles.micButton,
                  styles.micButtonSuccess,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
              >
                <MaterialIcons name="search" size={36} color="#fff" />
              </Pressable>
            )}

            {state === "error" && (
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.micButton,
                  styles.micButtonError,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                ]}
              >
                <MaterialIcons name="refresh" size={36} color="#fff" />
              </Pressable>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {state === "success" && (
              <>
                <Pressable
                  onPress={handleUseResult}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <MaterialIcons name="search" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>بحث بهذا النص</Text>
                </Pressable>
                <Pressable
                  onPress={handleRetry}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <MaterialIcons name="refresh" size={20} color="#2563EB" />
                  <Text style={styles.secondaryButtonText}>
                    إعادة المحاولة
                  </Text>
                </Pressable>
              </>
            )}

            {state === "error" && (
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <MaterialIcons name="refresh" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
              </Pressable>
            )}

            {state === "listening" && (
              <Text style={styles.hintText}>
                اضغط على زر الإيقاف عند الانتهاء من التحدث
              </Text>
            )}
          </View>

          {/* Language Indicator */}
          <View style={styles.languageIndicator}>
            <MaterialIcons name="language" size={16} color="#9CA3AF" />
            <Text style={styles.languageText}>العربية</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    minHeight: Dimensions.get("window").height * 0.65,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    left: 16,
    padding: 8,
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F2937",
    marginTop: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 6,
    textAlign: "center",
  },
  contentArea: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 120,
    marginVertical: 16,
  },
  // Wave bars
  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 3,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    minHeight: 8,
  },
  // Timer
  timerText: {
    fontSize: 28,
    fontWeight: "300",
    color: "#6B7280",
    letterSpacing: 4,
    marginBottom: 16,
    fontVariant: ["tabular-nums"],
  },
  // Mic button
  micButtonContainer: {
    width: 88,
    height: 88,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  micButtonBg: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  micButtonIdle: {
    backgroundColor: "#2563EB",
  },
  micButtonActive: {
    backgroundColor: "#DC2626",
  },
  micButtonProcessing: {
    backgroundColor: "#6B7280",
  },
  micButtonSuccess: {
    backgroundColor: "#16A34A",
  },
  micButtonError: {
    backgroundColor: "#F59E0B",
  },
  pulsingRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  pulsingRing2: {
    borderColor: "rgba(37, 99, 235, 0.5)",
  },
  // Processing
  processingContainer: {
    alignItems: "center",
    gap: 12,
  },
  processingText: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
  },
  // Result
  resultContainer: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  resultIconContainer: {
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  resultTextBox: {
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  resultTextContent: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E40AF",
    textAlign: "center",
    lineHeight: 28,
  },
  // Error
  errorContainer: {
    alignItems: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: "#DC2626",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  // Interim text (while listening)
  interimContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    width: "100%",
  },
  interimText: {
    fontSize: 16,
    color: "#4B5563",
    textAlign: "center",
    fontStyle: "italic",
  },
  // Action buttons
  actionButtons: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563EB",
  },
  hintText: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 4,
  },
  // Language indicator
  languageIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  languageText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
});
