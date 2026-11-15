import { ArrowLeftRight, CreditCard, Landmark, ScrollText, type LucideIcon } from "lucide-react";
import { bankFromIban, type BankId } from "@cuentalibre/core";
import type { PaymentMethod, PaymentMethodType } from "@cuentalibre/contracts";
import { cn } from "@cuentalibre/ui/lib/cn";
import bankinter from "./logos/bankinter.svg";
import bbva from "./logos/bbva.svg";
import caixabank from "./logos/caixabank.svg";
import cash from "./logos/cash.svg";
import ibercaja from "./logos/ibercaja.svg";
import kutxabank from "./logos/kutxabank.svg";
import n26 from "./logos/n26.svg";
import paypal from "./logos/paypal.svg";
import revolut from "./logos/revolut.svg";
import sabadell from "./logos/sabadell.svg";
import santander from "./logos/santander.svg";
import unicaja from "./logos/unicaja.svg";
import wise from "./logos/wise.svg";

const BANK_LOGOS: Record<BankId, string> = {
  bbva,
  santander,
  caixabank,
  sabadell,
  bankinter,
  unicaja,
  kutxabank,
  ibercaja,
  revolut,
  n26,
  wise,
};

const TYPE_ICONS: Record<Exclude<PaymentMethodType, "cash" | "paypal">, LucideIcon> = {
  transfer: ArrowLeftRight,
  directDebit: Landmark,
  card: CreditCard,
  promissory: ScrollText,
};

/** Picture of a payment method: its bank's logo when the IBAN reveals it, else an icon of its type. */
function methodLogo(method: Pick<PaymentMethod, "type" | "number">): string | null {
  if (method.type === "cash") return cash;
  if (method.type === "paypal") return paypal;
  const bank = bankFromIban(method.number);
  return bank && BANK_LOGOS[bank];
}

/** Square tile sized by `className` (e.g. "size-9"). */
export function MethodIcon({
  method,
  className,
}: {
  method: Pick<PaymentMethod, "type" | "number">;
  className?: string;
}) {
  const logo = methodLogo(method);
  if (logo)
    return (
      <img
        src={logo}
        alt=""
        className={cn("shrink-0 rounded-lg outline outline-1 -outline-offset-1 outline-border", className)}
      />
    );
  const Icon = TYPE_ICONS[method.type as keyof typeof TYPE_ICONS];
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground", className)}
    >
      <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}
