import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  Easing,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  FadeInLeft,
  SlideInRight,
  SlideInDown,
  ZoomIn,
  BounceIn,
  FlipInXUp,
  runOnJS,
} from "react-native-reanimated";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// ===== ANIMATED CARD WRAPPER =====
// Wraps any card with a staggered fade-in animation
interface AnimatedCardProps {
  index: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function AnimatedCard({ index, children, style }: AnimatedCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(400).springify()}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

// ===== PULSE ANIMATION =====
// Used for the voice search microphone button
interface PulseViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  active?: boolean;
}

export function PulseView({ children, style, active = true }: PulseViewProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // infinite
        true
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [active]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

// ===== BOUNCE PRESS ANIMATION =====
// Used for buttons that bounce when pressed (like add to cart)
interface BounceButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}

export function BounceButton({ onPress, children, style, disabled }: BounceButtonProps) {
  const scale = useSharedValue(1);

  const handlePress = () => {
    if (disabled) return;
    scale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1.05, { damping: 4, stiffness: 300 }),
      withSpring(1, { damping: 8, stiffness: 200 })
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ===== ADD TO CART SUCCESS ANIMATION =====
// Floating icon that flies up when item is added to cart
interface CartSuccessAnimationProps {
  visible: boolean;
  onComplete?: () => void;
}

export function CartSuccessAnimation({ visible, onComplete }: CartSuccessAnimationProps) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSequence(
        withSpring(1.3, { damping: 4, stiffness: 300 }),
        withSpring(1, { damping: 8, stiffness: 200 })
      );
      translateY.value = withSequence(
        withTiming(-30, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withDelay(600, withTiming(-80, { duration: 400, easing: Easing.in(Easing.cubic) }))
      );
      opacity.value = withDelay(800, withTiming(0, { duration: 300 }));
    } else {
      translateY.value = 0;
      opacity.value = 0;
      scale.value = 0.5;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.cartSuccessContainer, animatedStyle]}>
      <View style={styles.cartSuccessIcon}>
        <MaterialIcons name="check-circle" size={32} color="#22C55E" />
      </View>
    </Animated.View>
  );
}

// ===== SHIMMER LOADING PLACEHOLDER =====
// Animated shimmer effect for loading states
interface ShimmerProps {
  width: number;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Shimmer({ width, height, borderRadius = 8, style }: ShimmerProps) {
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmerValue.value, [0, 0.5, 1], [0.3, 0.7, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: "#E5E7EB" },
        animatedStyle,
        style,
      ]}
    />
  );
}

// ===== FADE SLIDE SECTION =====
// Section that fades in and slides from a direction
interface FadeSlideSectionProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

export function FadeSlideSection({ children, direction = "up", delay = 0, duration = 500, style }: FadeSlideSectionProps) {
  const entering = (() => {
    switch (direction) {
      case "up": return FadeInUp.delay(delay).duration(duration).springify();
      case "down": return FadeInDown.delay(delay).duration(duration).springify();
      case "left": return FadeInLeft.delay(delay).duration(duration).springify();
      case "right": return FadeInRight.delay(delay).duration(duration).springify();
    }
  })();

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

// ===== COUNTER ANIMATION =====
// Animated number counter (for prices, totals, etc.)
interface AnimatedCounterProps {
  value: number;
  style?: any;
  suffix?: string;
  decimals?: number;
}

export function AnimatedCounter({ value, style, suffix = "", decimals = 2 }: AnimatedCounterProps) {
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  // For simplicity, we just display the value with spring animation on the container
  const scale = useSharedValue(1);
  
  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.1, { duration: 150 }),
      withSpring(1, { damping: 8, stiffness: 200 })
    );
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={style}>{value.toFixed(decimals)}{suffix}</Text>
    </Animated.View>
  );
}

// ===== STAGGER LIST =====
// Renders children with staggered animation
interface StaggerListProps {
  children: React.ReactNode[];
  staggerDelay?: number;
}

export function StaggerList({ children, staggerDelay = 80 }: StaggerListProps) {
  return (
    <>
      {React.Children.map(children, (child, index) => (
        <Animated.View
          key={index}
          entering={FadeInDown.delay(index * staggerDelay).duration(400).springify()}
        >
          {child}
        </Animated.View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  cartSuccessContainer: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 100,
  },
  cartSuccessIcon: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
});
