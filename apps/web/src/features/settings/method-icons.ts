import { ArrowLeftRight, Banknote, CreditCard, Landmark, ScrollText, Wallet, type LucideIcon } from "lucide-react";
import type { PaymentMethodType } from "@cuentalibre/contracts";

export const METHOD_ICONS: Record<PaymentMethodType, LucideIcon> = {
  transfer: ArrowLeftRight,
  directDebit: Landmark,
  card: CreditCard,
  cash: Banknote,
  paypal: Wallet,
  promissory: ScrollText,
};
