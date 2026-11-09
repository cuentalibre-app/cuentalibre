import { Link } from "react-router";
import { cn } from "@cuentalibre/ui/lib/cn";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Lock } from "lucide-react";
import type { Period } from "@cuentalibre/core";
import { closingPath, quarterName } from "./closing-model";

/** Shown on a document whose quarter is closed: it can be read but not changed. */
export function LockedNotice({ period, noun }: { period: Period; noun: string }) {
  return (
    <p
      role="status"
      className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted px-3.5 py-3 text-sm"
    >
      <Lock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
      <span>
        {noun} es del {quarterName(period)}, que está cerrado: solo puedes consultarlo.
      </span>
      <Link to={closingPath(period)} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "ml-auto")}>
        Ir al cierre del trimestre
      </Link>
    </p>
  );
}
