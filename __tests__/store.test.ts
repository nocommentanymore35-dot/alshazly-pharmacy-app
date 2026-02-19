import { describe, it, expect } from "vitest";

// Test the store reducer logic directly
interface CartItem {
  medicineId: number;
  nameAr: string;
  nameEn: string;
  price: string;
  quantity: number;
  imageUrl?: string;
}

interface FavoriteItem {
  medicineId: number;
  nameAr: string;
  nameEn: string;
  price: string;
  imageUrl?: string;
  categoryId: number;
}

interface CustomerProfile {
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
      if (existing) return state;
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

function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
}

const sampleMedicine: CartItem = {
  medicineId: 1,
  nameAr: "باراسيتامول",
  nameEn: "Paracetamol",
  price: "15.50",
  quantity: 2,
};

const sampleFavorite: FavoriteItem = {
  medicineId: 1,
  nameAr: "باراسيتامول",
  nameEn: "Paracetamol",
  price: "15.50",
  categoryId: 1,
};

describe("App Store Reducer", () => {
  it("should start with initial state", () => {
    expect(initialState.cart).toEqual([]);
    expect(initialState.favorites).toEqual([]);
    expect(initialState.profile.fullName).toBe("");
    expect(initialState.isAdminLoggedIn).toBe(false);
  });

  describe("Cart operations", () => {
    it("should add item to cart", () => {
      const newState = appReducer(initialState, { type: "ADD_TO_CART", payload: sampleMedicine });
      expect(newState.cart).toHaveLength(1);
      expect(newState.cart[0].nameAr).toBe("باراسيتامول");
    });

    it("should not add duplicate item to cart", () => {
      const state1 = appReducer(initialState, { type: "ADD_TO_CART", payload: sampleMedicine });
      const state2 = appReducer(state1, { type: "ADD_TO_CART", payload: sampleMedicine });
      expect(state2.cart).toHaveLength(1);
    });

    it("should remove item from cart", () => {
      const state1 = appReducer(initialState, { type: "ADD_TO_CART", payload: sampleMedicine });
      const state2 = appReducer(state1, { type: "REMOVE_FROM_CART", payload: 1 });
      expect(state2.cart).toHaveLength(0);
    });

    it("should clear cart", () => {
      let state = appReducer(initialState, { type: "ADD_TO_CART", payload: sampleMedicine });
      state = appReducer(state, { type: "ADD_TO_CART", payload: { ...sampleMedicine, medicineId: 2, nameAr: "أموكسيسيلين" } });
      const cleared = appReducer(state, { type: "CLEAR_CART" });
      expect(cleared.cart).toHaveLength(0);
    });

    it("should calculate cart total correctly", () => {
      const cart: CartItem[] = [
        { medicineId: 1, nameAr: "دواء 1", nameEn: "Med 1", price: "10.00", quantity: 2 },
        { medicineId: 2, nameAr: "دواء 2", nameEn: "Med 2", price: "25.50", quantity: 1 },
      ];
      expect(cartTotal(cart)).toBe(45.50);
    });

    it("should calculate cart total as 0 for empty cart", () => {
      expect(cartTotal([])).toBe(0);
    });
  });

  describe("Favorites operations", () => {
    it("should add item to favorites", () => {
      const newState = appReducer(initialState, { type: "ADD_TO_FAVORITES", payload: sampleFavorite });
      expect(newState.favorites).toHaveLength(1);
    });

    it("should not add duplicate favorite", () => {
      const state1 = appReducer(initialState, { type: "ADD_TO_FAVORITES", payload: sampleFavorite });
      const state2 = appReducer(state1, { type: "ADD_TO_FAVORITES", payload: sampleFavorite });
      expect(state2.favorites).toHaveLength(1);
    });

    it("should remove item from favorites", () => {
      const state1 = appReducer(initialState, { type: "ADD_TO_FAVORITES", payload: sampleFavorite });
      const state2 = appReducer(state1, { type: "REMOVE_FROM_FAVORITES", payload: 1 });
      expect(state2.favorites).toHaveLength(0);
    });
  });

  describe("Profile operations", () => {
    it("should set profile data", () => {
      const newState = appReducer(initialState, {
        type: "SET_PROFILE",
        payload: { fullName: "أحمد محمد", phone: "01012345678", address: "القاهرة" },
      });
      expect(newState.profile.fullName).toBe("أحمد محمد");
      expect(newState.profile.phone).toBe("01012345678");
      expect(newState.profile.address).toBe("القاهرة");
    });

    it("should partially update profile", () => {
      const state1 = appReducer(initialState, {
        type: "SET_PROFILE",
        payload: { fullName: "أحمد", phone: "01012345678", address: "القاهرة" },
      });
      const state2 = appReducer(state1, {
        type: "SET_PROFILE",
        payload: { address: "الإسكندرية" },
      });
      expect(state2.profile.fullName).toBe("أحمد");
      expect(state2.profile.address).toBe("الإسكندرية");
    });
  });

  describe("Admin operations", () => {
    it("should set admin logged in", () => {
      const newState = appReducer(initialState, { type: "SET_ADMIN_LOGGED_IN", payload: true });
      expect(newState.isAdminLoggedIn).toBe(true);
    });

    it("should set admin logged out", () => {
      const state1 = appReducer(initialState, { type: "SET_ADMIN_LOGGED_IN", payload: true });
      const state2 = appReducer(state1, { type: "SET_ADMIN_LOGGED_IN", payload: false });
      expect(state2.isAdminLoggedIn).toBe(false);
    });
  });

  describe("Device and Customer ID", () => {
    it("should set device ID", () => {
      const newState = appReducer(initialState, { type: "SET_DEVICE_ID", payload: "device_abc123" });
      expect(newState.deviceId).toBe("device_abc123");
    });

    it("should set customer ID", () => {
      const newState = appReducer(initialState, { type: "SET_CUSTOMER_ID", payload: 42 });
      expect(newState.customerId).toBe(42);
    });
  });

  describe("Load state", () => {
    it("should load partial state", () => {
      const newState = appReducer(initialState, {
        type: "LOAD_STATE",
        payload: {
          deviceId: "saved_device",
          customerId: 5,
          profile: { fullName: "محمد", phone: "010", address: "القاهرة" },
        },
      });
      expect(newState.deviceId).toBe("saved_device");
      expect(newState.customerId).toBe(5);
      expect(newState.profile.fullName).toBe("محمد");
    });
  });
});
