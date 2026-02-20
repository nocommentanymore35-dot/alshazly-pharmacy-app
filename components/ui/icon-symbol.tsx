// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "heart.fill": "favorite",
  "cart.fill": "shopping-cart",
  "person.fill": "person",
  "gearshape.fill": "settings",
  "magnifyingglass": "search",
  "plus": "add",
  "minus": "remove",
  "trash.fill": "delete",
  "xmark": "close",
  "checkmark": "check",
  "arrow.left": "arrow-back",
  "star.fill": "star",
  "doc.text": "description",
  "chart.bar": "bar-chart",
  "bell.fill": "notifications",
  "pencil": "edit",
  "photo": "photo",
  "list.bullet": "list",
  "arrow.right": "arrow-forward",
  "lock.fill": "lock",
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
  "gift.fill": "card-giftcard",
  "square.and.arrow.up": "share",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
