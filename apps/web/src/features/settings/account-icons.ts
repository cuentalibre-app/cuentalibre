import { Banknote, CreditCard, Landmark, Wallet, type LucideIcon } from "lucide-react";
import type { AccountKind } from "@/mocks/settings";

export const ACCOUNT_ICONS: Record<AccountKind, LucideIcon> = {
  bank: Landmark,
  cash: Banknote,
  paypal: Wallet,
  card: CreditCard,
};
