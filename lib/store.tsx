import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Types
export type UnitType = "strip" | "box";

export interface CartItem {
  medicineId: number;
  nameAr: string;
  nameEn: string;
  price: string; // price per box
  quantity: number;
  unitType: UnitType; // "strip" or "box"
  stripsPerBox: number; // how many strips in one box
  imageUrl?: string;
}

export interface FavoriteItem {
  medicineId: number;
  nameAr: string;
  nameEn: string;
  price: string;
  imageUrl?: string;
  categoryId: number;
}

export interface CustomerProfile {
  fullName: string;
  phone: string;
  address: string;
}

export interface LoyaltyTransaction {
  id: string;
  date: string; // ISO date
  points: number;
  description: string;
  orderId?: number;
}

export interface LoyaltyState {
  totalPoints: number;
  transactions: LoyaltyTransaction[];
  lastResetYear?: number; // The year of the last annual reset
  archivedYears?: { year: number; totalPoints: number; transactions: LoyaltyTransaction[] }[];
}

interface AppState {
  cart: CartItem[];
  favorites: FavoriteItem[];
  profile: CustomerProfile;
  deviceId: string;
  customerId: number | null;
  isAdminLoggedIn: boolean;
  loyalty: LoyaltyState;
}

type Action =
  | { type: "ADD_TO_CART"; payload: CartItem }
  | { type: "REMOVE_FROM_CART"; payload: number }
  | { type: "CLEAR_CART" }
  | { type: "ADD_TO_FAVORITES"; payload: FavoriteItem }
  | { type: "REMOVE_FROM_FAVORITES"; payload: number }
  | { type: "SET_PROFILE"; payload: Partial<CustomerProfile> }
  | { type: "SET_DEVICE_ID"; payload: string }
  | { type: "SET_CUSTOMER_ID"; payload: number }
  | { type: "SET_ADMIN_LOGGED_IN"; payload: boolean }
  | { type: "ADD_LOYALTY_POINTS"; payload: { points: number; description: string; orderId?: number } }
  | { type: "RESET_LOYALTY_YEAR"; payload: { year: number } }
  | { type: "LOAD_STATE"; payload: Partial<AppState> };

const initialState: AppState = {
  cart: [],
  favorites: [],
  profile: { fullName: "", phone: "", address: "" },
  deviceId: "",
  customerId: null,
  isAdminLoggedIn: false,
  loyalty: { totalPoints: 0, transactions: [] },
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADD_TO_CART": {
      const existing = state.cart.find(i => i.medicineId === action.payload.medicineId);
      if (existing) return state; // Already in cart, don't add again
      return { ...state, cart: [...state.cart, action.payload] };
    }
    case "REMOVE_FROM_CART":
      return { ...state, cart: state.cart.filter(i => i.medicineId !== action.payload) };
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "ADD_TO_FAVORITES": {
      const exists = state.favorites.find(i => i.medicineId === action.payload.medicineId);
      if (exists) return state;
      return { ...state, favorites: [...state.favorites, action.payload] };
    }
    case "REMOVE_FROM_FAVORITES":
      return { ...state, favorites: state.favorites.filter(i => i.medicineId !== action.payload) };
    case "SET_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case "SET_DEVICE_ID":
      return { ...state, deviceId: action.payload };
    case "SET_CUSTOMER_ID":
      return { ...state, customerId: action.payload };
    case "SET_ADMIN_LOGGED_IN":
      return { ...state, isAdminLoggedIn: action.payload };
    case "ADD_LOYALTY_POINTS": {
      const transaction: LoyaltyTransaction = {
        id: "txn_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        date: new Date().toISOString(),
        points: action.payload.points,
        description: action.payload.description,
        orderId: action.payload.orderId,
      };
      return {
        ...state,
        loyalty: {
          ...state.loyalty,
          totalPoints: state.loyalty.totalPoints + action.payload.points,
          transactions: [transaction, ...state.loyalty.transactions],
        },
      };
    }
    case "RESET_LOYALTY_YEAR": {
      const prevYear = action.payload.year - 1;
      const archivedEntry = {
        year: prevYear,
        totalPoints: state.loyalty.totalPoints,
        transactions: state.loyalty.transactions,
      };
      const existingArchives = state.loyalty.archivedYears || [];
      return {
        ...state,
        loyalty: {
          totalPoints: 0,
          transactions: [],
          lastResetYear: action.payload.year,
          archivedYears: [...existingArchives, archivedEntry],
        },
      };
    }
    case "LOAD_STATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// Helper to calculate item total price
export function calcItemTotal(item: CartItem): number {
  const boxPrice = parseFloat(item.price);
  const stripsPerBox = item.stripsPerBox || 1;
  if (item.unitType === "strip") {
    const stripPrice = boxPrice / stripsPerBox;
    return stripPrice * item.quantity;
  }
  return boxPrice * item.quantity;
}

// Helper to get unit label
export function getUnitLabel(unitType: UnitType, quantity: number): string {
  if (unitType === "strip") {
    return quantity === 1 ? "شريط" : quantity === 2 ? "شريطين" : `${quantity} شرائط`;
  }
  return quantity === 1 ? "علبة" : quantity === 2 ? "علبتين" : `${quantity} علب`;
}

// Helper to get price per unit
export function getPricePerUnit(boxPrice: string, stripsPerBox: number, unitType: UnitType): number {
  const price = parseFloat(boxPrice);
  if (unitType === "strip") {
    return price / (stripsPerBox || 1);
  }
  return price;
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addToCart: (item: CartItem) => void;
  removeFromCart: (medicineId: number) => void;
  clearCart: () => void;
  addToFavorites: (item: FavoriteItem) => void;
  removeFromFavorites: (medicineId: number) => void;
  isFavorite: (medicineId: number) => boolean;
  isInCart: (medicineId: number) => boolean;
  cartTotal: () => number;
  setProfile: (data: Partial<CustomerProfile>) => void;
  setAdminLoggedIn: (value: boolean) => void;
  addLoyaltyPoints: (points: number, description: string, orderId?: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = "pharmacy_app_state";

function generateDeviceId(): string {
  return "device_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load state from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Migrate old cart items that don't have unitType
          if (parsed.cart) {
            parsed.cart = parsed.cart.map((item: any) => ({
              ...item,
              unitType: item.unitType || "box",
              stripsPerBox: item.stripsPerBox || 1,
            }));
          }
          dispatch({ type: "LOAD_STATE", payload: parsed });
          if (!parsed.deviceId) {
            const id = generateDeviceId();
            dispatch({ type: "SET_DEVICE_ID", payload: id });
          }
          // Check for annual loyalty reset
          const currentYear = new Date().getFullYear();
          const lastResetYear = parsed.loyalty?.lastResetYear || 0;
          if (lastResetYear > 0 && lastResetYear < currentYear) {
            // New year detected - reset loyalty points
            dispatch({ type: "RESET_LOYALTY_YEAR", payload: { year: currentYear } });
          } else if (lastResetYear === 0 && parsed.loyalty?.transactions?.length > 0) {
            // First time: check if there are transactions from a previous year
            const oldestTxYear = parsed.loyalty.transactions.reduce((min: number, t: any) => {
              const y = new Date(t.date).getFullYear();
              return y < min ? y : min;
            }, currentYear);
            if (oldestTxYear < currentYear) {
              dispatch({ type: "RESET_LOYALTY_YEAR", payload: { year: currentYear } });
            }
          }
        } else {
          const id = generateDeviceId();
          dispatch({ type: "SET_DEVICE_ID", payload: id });
        }
      } catch (e) {
        const id = generateDeviceId();
        dispatch({ type: "SET_DEVICE_ID", payload: id });
      }
    })();
  }, []);

  // Save state to AsyncStorage on change
  useEffect(() => {
    if (state.deviceId) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        cart: state.cart,
        favorites: state.favorites,
        profile: state.profile,
        deviceId: state.deviceId,
        customerId: state.customerId,
        loyalty: {
          ...state.loyalty,
          lastResetYear: state.loyalty.lastResetYear || new Date().getFullYear(),
        },
      }));
    }
  }, [state.cart, state.favorites, state.profile, state.deviceId, state.customerId, state.loyalty]);

  const addToCart = useCallback((item: CartItem) => dispatch({ type: "ADD_TO_CART", payload: item }), []);
  const removeFromCart = useCallback((id: number) => dispatch({ type: "REMOVE_FROM_CART", payload: id }), []);
  const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), []);
  const addToFavorites = useCallback((item: FavoriteItem) => dispatch({ type: "ADD_TO_FAVORITES", payload: item }), []);
  const removeFromFavorites = useCallback((id: number) => dispatch({ type: "REMOVE_FROM_FAVORITES", payload: id }), []);
  const isFavorite = useCallback((id: number) => state.favorites.some(i => i.medicineId === id), [state.favorites]);
  const isInCart = useCallback((id: number) => state.cart.some(i => i.medicineId === id), [state.cart]);
  const cartTotal = useCallback(() => state.cart.reduce((sum, item) => sum + calcItemTotal(item), 0), [state.cart]);
  const setProfile = useCallback((data: Partial<CustomerProfile>) => dispatch({ type: "SET_PROFILE", payload: data }), []);
  const setAdminLoggedIn = useCallback((value: boolean) => dispatch({ type: "SET_ADMIN_LOGGED_IN", payload: value }), []);
  const addLoyaltyPoints = useCallback((points: number, description: string, orderId?: number) => dispatch({ type: "ADD_LOYALTY_POINTS", payload: { points, description, orderId } }), []);

  return (
    <AppContext.Provider value={{
      state, dispatch, addToCart, removeFromCart, clearCart,
      addToFavorites, removeFromFavorites, isFavorite, isInCart,
      cartTotal, setProfile, setAdminLoggedIn, addLoyaltyPoints,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppStore must be used within AppProvider");
  return ctx;
}
