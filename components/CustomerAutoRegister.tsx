import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";

/**
 * This component auto-registers the customer in the database
 * as soon as the app starts and deviceId is available.
 * It ALWAYS verifies the customer exists in the database,
 * even if customerId is already stored locally (handles DB resets).
 */
export function CustomerAutoRegister() {
  const { state, dispatch, setProfile } = useAppStore();
  const customerMutation = trpc.customers.getOrCreate.useMutation();
  const hasRegistered = useRef(false);

  useEffect(() => {
    // Only run when deviceId is available and we haven't already registered in this session
    if (!state.deviceId || hasRegistered.current) return;

    // ALWAYS call getOrCreate to ensure customer exists in DB
    // This handles: first time, DB reset, server redeployment, etc.
    hasRegistered.current = true;
    
    customerMutation.mutate(
      { deviceId: state.deviceId },
      {
        onSuccess: (data) => {
          if (data) {
            // Always update customerId (may have changed after DB reset)
            dispatch({ type: "SET_CUSTOMER_ID", payload: data.id });
            // If customer has profile data in DB, load it
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
          // Allow retry on next render
          hasRegistered.current = false;
        },
      }
    );
  }, [state.deviceId]);

  return null; // No UI
}
