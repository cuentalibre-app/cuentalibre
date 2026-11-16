import { cn } from "@cuentalibre/ui/lib/cn";

/** A form's number as a small chip, muted when the form doesn't apply. */
export function FormCode({ code, muted = false }: { code: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-10 shrink-0 justify-center rounded-sm py-0.5 text-xs font-semibold tabular-nums",
        muted ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary",
      )}
    >
      {code}
    </span>
  );
}
