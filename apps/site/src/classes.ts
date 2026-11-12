/** Class lists the marketing pages share, so the home page and /cloud look like one site. */

/** White tab that slides under the chosen tab; the script places it and marks the group ready */
export const indicator =
  "pointer-events-none absolute top-0 left-0 rounded-full bg-background opacity-0 shadow-tab transition-[transform,width,height] duration-300 ease-out in-data-ready:opacity-100";
export const eyebrow = "font-brand text-[14px] font-semibold text-primary";
export const sectionTitle =
  "font-display text-[clamp(32px,4vw,44px)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance";
/** Call-to-action pair: compact pill buttons, stacked and centered on phones, side by side from sm */
export const buttonRow = "flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center";
const ctaButton =
  "inline-flex min-w-[216px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[15px] no-underline sm:min-w-0";
export const primaryButton = `${ctaButton} font-semibold button-brand`;
export const secondaryButton = `${ctaButton} border border-input font-medium text-foreground transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98]`;
/** In the big prices a monospaced space reads as a gap, so the euro sign gets a narrow margin instead */
export const euroSign = "ml-[0.28em]";
