import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Types
export interface CartItem {
  medicineId: number;
  nameAr: string;
  nameEn: string;
  price: string;
  quantity: number;
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

interface AppState {
  cart: CartItem[];
  favorites: FavoriteItem[];
  profile: CustomerProfile;
  deviceId: string;
  customerId: number | null;
  isAdminLoggedIn: boolean;
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
  | { type: "LOAD_STATE"; payload: Partial<AppState> };

const initialState: AppState = {
  cart: [],
  favorites: [],
  profile: { fullName: "", phone: "", address: "" },
  deviceId: "",
  customerId: null,
  isAdminLoggedIn: false,
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
    case "LOAD_STATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
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
          dispatch({ type: "LOAD_STATE", payload: parsed });
          if (!parsed.deviceId) {
            const id = generateDeviceId();
            dispatch({ type: "SET_DEVICE_ID", payload: id });
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
      }));
    }
  }, [state.cart, state.favorites, state.profile, state.deviceId, state.customerId]);

  const addToCart = useCallback((item: CartItem) => dispatch({ type: "ADD_TO_CART", payload: item }), []);
  const removeFromCart = useCallback((id: number) => dispatch({ type: "REMOVE_FROM_CART", payload: id }), []);
  const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), []);
  const addToFavorites = useCallback((item: FavoriteItem) => dispatch({ type: "ADD_TO_FAVORITES", payload: item }), []);
  const removeFromFavorites = useCallback((id: number) => dispatch({ type: "REMOVE_FROM_FAVORITES", payload: id }), []);
  const isFavorite = useCallback((id: number) => state.favorites.some(i => i.medicineId === id), [state.favorites]);
  const isInCart = useCallback((id: number) => state.cart.some(i => i.medicineId === id), [state.cart]);
  const cartTotal = useCallback(() => state.cart.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0), [state.cart]);
  const setProfile = useCallback((data: Partial<CustomerProfile>) => dispatch({ type: "SET_PROFILE", payload: data }), []);
  const setAdminLoggedIn = useCallback((value: boolean) => dispatch({ type: "SET_ADMIN_LOGGED_IN", payload: value }), []);

  return (
    <AppContext.Provider value={{
      state, dispatch, addToCart, removeFromCart, clearCart,
      addToFavorites, removeFromFavorites, isFavorite, isInCart,
      cartTotal, setProfile, setAdminLoggedIn,
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
