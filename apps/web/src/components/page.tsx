import type { ComponentProps, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@cuentalibre/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { HelpChatToggle } from "@/features/help-chat/help-chat-toggle";

/*
 * The frame every page shares: the same margins, the same header and the same toolbar,
 * so pages differ only in what they show.
 */

/** A page's outer frame: side margins and the gap between its blocks. */
export function Page({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-5 px-5 pt-6 pb-8 lg:gap-5 lg:px-6 lg:pt-5", className)} {...props} />;
}

/** The round-cornered square arrow at the start of a header that leads one level up. */
export function BackLink({ label, className, ...props }: LinkProps & { label: string }) {
  return (
    <Link
      aria-label={label}
      title={label}
      className={cn(buttonVariants({ variant: "secondary", size: "icon" }), className)}
      {...props}
    >
      <ArrowLeft strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  /** One line under the title saying what the page is for. */
  description?: ReactNode;
  /** Classes for the description, such as hiding it on phones where the screen is short. */
  descriptionClassName?: string;
  /** A back link before the title, usually a <BackLink>. */
  back?: ReactNode;
  /** A small line above the title, such as a breadcrumb. */
  eyebrow?: ReactNode;
  /** Controls right after the title, such as the period. */
  inline?: ReactNode;
  /** Actions at the end of the header. */
  actions?: ReactNode;
  /** Classes for the actions' row, such as taking a line of its own on phones. */
  actionsClassName?: string;
  /** The assistant's toggle (far right on desktop, first on phones); off for headers that place it themselves. */
  assistant?: boolean;
  className?: string;
}

/** Title, optional back link and description on the left; actions on the right. */
export function PageHeader({
  title,
  description,
  descriptionClassName,
  back,
  eyebrow,
  inline,
  actions,
  actionsClassName,
  assistant = true,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      {/* The title keeps a minimum width, so actions that don't fit beside it wrap below instead of squeezing it away */}
      <div className="flex min-w-0 flex-[1_1_10rem] items-center gap-3">
        {back}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {eyebrow}
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className="m-0 min-w-0 text-xl font-semibold tracking-tight text-balance lg:text-title">{title}</h1>
            {inline}
          </div>
          {description && (
            <p className={cn("m-0 max-w-[72ch] text-sm text-muted-foreground", descriptionClassName)}>{description}</p>
          )}
        </div>
      </div>
      {(actions || assistant) && (
        <div className={cn("flex flex-wrap items-center gap-2.5", actionsClassName)}>
          {actions}
          {/*
           * Set apart from the page's own actions, as it belongs to the app rather than the page: last on
           * desktop; first on phones, so the page's main action keeps the corner
           */}
          {assistant && <HelpChatToggle className={cn("max-lg:order-first", actions && "max-lg:mr-1 lg:ml-1")} />}
        </div>
      )}
    </header>
  );
}

/**
 * The row of search, filters and exports above a list. On phones it is a single line: the search
 * takes what the controls beside it leave, and anything that doesn't fit wraps below.
 */
export function Toolbar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 pb-3 *:not-first:max-lg:flex-none lg:gap-2.5 lg:px-4 lg:py-3",
        "*:first:max-lg:min-w-0 *:first:max-lg:flex-[1_1_8rem]",
        "[&>label:first-child]:lg:max-w-80 [&>label:first-child]:lg:flex-[1_1_220px]",
        className,
      )}
      {...props}
    />
  );
}

/** The question mark next to a label that explains it on hover or tap. */
export function HelpTip({
  label = "Más información",
  side,
  contentClassName,
  children,
  className,
}: {
  label?: string;
  side?: ComponentProps<typeof TooltipContent>["side"];
  /** For long, structured content: a wider box with more padding. */
  contentClassName?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          // Marks the button as an explanation, not an action, for the guide's screen inventory
          data-help-tip=""
          className={cn(
            "inline-grid size-5 cursor-help place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground transition-colors duration-150 hover:text-foreground",
            className,
          )}
        >
          <CircleHelp className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className={cn("block max-w-72 leading-snug font-normal", contentClassName)}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

interface SectionProps {
  /** Id of the heading, for aria-labelledby. */
  id: string;
  title: ReactNode;
  /** A short line under the title, such as a count or a warning. */
  subtitle?: ReactNode;
  /** One link at the end of the title row, usually a <SeeAllLink>. */
  action?: ReactNode;
  /** A small icon before the title on desktop. */
  icon?: LucideIcon;
  className?: string;
  /** Classes for the body; on phones it is the card. */
  bodyClassName?: string;
  children: ReactNode;
}

/** A card's title row on desktop: icon and title on the left, a ruled line under it. */
export const cardHeaderClass =
  "lg:flex lg:items-center lg:justify-between lg:gap-3 lg:border-b lg:border-divider lg:px-4 lg:py-3";
/** The card's title: larger than body text, with its icon standing on the text's baseline. */
export const cardTitleClass = "m-0 flex items-baseline gap-2.5 text-lg font-semibold tracking-tight";
/**
 * The icon before a card's title; hidden on phones, where the title sits on the page. Nudged down
 * by the icon's inner padding so its drawing, not its box, stands on the baseline.
 */
export const cardIconClass = "hidden size-5 shrink-0 translate-y-[1.5px] text-foreground lg:block";

/**
 * A titled block of a dashboard. On phones the title sits on the page and the content in a card
 * under it; on desktop title and content share one card.
 */
export function Section({ id, title, subtitle, action, icon: Icon, className, bodyClassName, children }: SectionProps) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2.5 lg:gap-0 lg:surface", className)}>
      <div className={cn("flex items-baseline justify-between gap-3", cardHeaderClass)}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className={cardTitleClass}>
            {Icon && <Icon className={cardIconClass} strokeWidth={1.8} aria-hidden="true" />}
            {title}
          </h2>
          {subtitle}
        </div>
        {action}
      </div>
      <div
        className={cn(
          "flex flex-col gap-4 surface p-4 lg:flex-1 lg:rounded-none lg:border-0 lg:bg-transparent",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * "Ver todas" at the end of a card's title row: quiet text that lines up with the title,
 * so it never weighs more than the heading it belongs to.
 */
export function SeeAllLink({ className, children, ...props }: LinkProps) {
  return (
    <Link
      className={cn(
        "group -mr-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-sm font-medium text-muted-foreground no-underline transition-colors duration-150 hover:bg-muted hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight
        className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
        strokeWidth={2}
        aria-hidden="true"
      />
    </Link>
  );
}

/** Rows grouped in one card with rules between them, as phones list things. Children are <li>. */
export function ListGroup({ className, ...props }: ComponentProps<"ul">) {
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-col overflow-hidden surface px-4 py-0 [&>li+li>*]:border-t [&>li+li>*]:border-divider",
        className,
      )}
      {...props}
    />
  );
}

/** A tappable row of a ListGroup. */
export const listRowClass =
  "flex min-h-14 items-center gap-3 py-3 text-foreground no-underline transition-opacity duration-150 active:opacity-60";

const NOTICE_TONES = {
  muted: { box: "bg-muted", icon: "text-muted-foreground", Icon: Info },
  info: { box: "bg-primary-soft", icon: "text-primary", Icon: Info },
  warning: { box: "bg-warning-soft", icon: "text-warning", Icon: TriangleAlert },
  danger: { box: "bg-destructive-soft", icon: "text-destructive", Icon: CircleAlert },
  success: { box: "bg-success-soft", icon: "text-success", Icon: CircleCheck },
} as const;

/**
 * A short message in a soft tinted box with its tone's icon: the one shape for inline notes and warnings.
 * With `onDismiss` it gets a close button.
 */
export function Notice({
  tone = "info",
  icon,
  onDismiss,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { tone?: keyof typeof NOTICE_TONES; icon?: LucideIcon; onDismiss?: () => void }) {
  const { box, icon: iconClass, Icon: DefaultIcon } = NOTICE_TONES[tone];
  const Icon = icon ?? DefaultIcon;
  return (
    <div className={cn("flex gap-2 rounded-xl px-3.5 py-3 text-sm text-foreground", box, className)} {...props}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Cerrar el aviso"
          onClick={onDismiss}
          className="-my-1.5 -mr-1.5"
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
