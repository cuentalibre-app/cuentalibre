import "i18next";
import type es from "./locales/es.json";

// Keys come from the Spanish source, so `t()` with a key that doesn't exist fails to typecheck
declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: typeof es };
  }
}
