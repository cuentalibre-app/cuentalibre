import { eurosToCents } from "@cuentalibre/core";
import type { ManualPayment } from "@cuentalibre/contracts";

export const initialManualPayments: ManualPayment[] = [
  {
    id: "mp1",
    date: "2026-07-01",
    amount: eurosToCents(-1_500),
    paymentMethodId: "transfer",
    description: "Traspaso a la cuenta de ahorro para el IRPF",
  },
];
