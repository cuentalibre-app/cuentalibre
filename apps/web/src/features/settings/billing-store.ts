import { useEffect } from "react";
import type { Billing } from "@cuentalibre/contracts";
import { currentBackend } from "@/data/backend";
import { createStore } from "@/data/store";
import { signInMethods } from "@/features/auth/auth-api";

/** The company's plan, on instances that charge for one (cuentalibre Cloud); null elsewhere and until it loads. */
const billing = createStore<Billing | null>(null);
let loaded = false;

/** Asks the API for the plan again: after paying, or when it turns a change away because of it. */
export async function refreshBilling() {
  const api = currentBackend().billing;
  if (!api) return;
  try {
    const methods = await signInMethods();
    billing.set(methods.billing ? await api.get() : null);
  } catch {
    // Without the plan the app still works; its page says what went wrong
  }
}

/** The plan, loaded the first time a component asks for it. */
export function useBilling() {
  useEffect(() => {
    if (loaded) return;
    loaded = true;
    void refreshBilling();
  }, []);
  return billing.use();
}

/** For the plan page, which loads the plan itself and waits for Stripe after paying. */
export const setBilling = billing.set;
