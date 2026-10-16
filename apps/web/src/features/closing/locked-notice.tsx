import { Link } from "react-router";
import { Lock } from "lucide-react";
import type { Period } from "@fiscalia/core";
import { closingPath, quarterName } from "./closing-model";

/** Shown on a document whose quarter is closed: it can be read but not changed. */
export function LockedNotice({ period, noun }: { period: Period; noun: string }) {
  return (
    <p role="status" className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-muted px-4 py-3 text-sm">
      <Lock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
      <span>
        {noun} es del {quarterName(period)}, que está cerrado: solo puedes consultarlo.
      </span>
      <Link to={closingPath(period)} className="font-medium text-primary no-underline hover:text-primary-hover">
        Ir al cierre del trimestre
      </Link>
    </p>
  );
}
