import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

/**
 * This component auto-registers the customer in the database
 * as soon as the app starts and deviceId is available.
 * It runs silently in the background without any UI.
 */
export function CustomerAutoRegister() {
  const { state, dispatch, setProfile } = useAppStore();
  const customerMutation = trpc.customers.getOrCreate.useMutation();

  useEffect(() => {
    if (state.deviceId && !state.customerId) {
      customerMutation.mutate(
        { deviceId: state.deviceId },
        {
          onSuccess: (data) => {
            if (data) {
              dispatch({ type: "SET_CUSTOMER_ID", payload: data.id });
              if (data.fullName) {
                setProfile({
                  fullName: data.fullName,
                  phone: data.phone ?? "",
                  address: data.address ?? "",
                });
              }
            }
          },
          onError: (err) => {
            console.warn("CustomerAutoRegister: failed to register", err);
          },
        }
      );
    }
  }, [state.deviceId, state.customerId]);

  return null; // No UI
}
