import { cn } from "@cuentalibre/ui/lib/cn";

/**
 * The cuentalibre mark: rising columns whose last one is a person, the self-employed
 * standing out over their numbers. Columns take the text colour; the head is a light slate.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 208" className={cn("shrink-0", className)} aria-hidden="true">
      <g className="fill-current">
        <rect x="0" y="132" width="52" height="76" rx="14" />
        <rect x="70" y="88" width="52" height="120" rx="14" />
        <rect x="140" y="68" width="52" height="140" rx="14" />
      </g>
      <circle cx="166" cy="26" r="26" className="fill-brand-mark" />
    </svg>
  );
}
