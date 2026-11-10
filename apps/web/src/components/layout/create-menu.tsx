import { Fragment, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cuentalibre/ui/components/dropdown-menu";
import { useDragToDismiss } from "@cuentalibre/ui/lib/drag-to-dismiss";
import { createActions, type CreateAction } from "./nav";
import { useHoverMenu } from "./use-hover-menu";

interface CreateMenuProps {
  /** The trigger element; it must be a single button. */
  children: ReactNode;
  side?: "top" | "right" | "bottom";
  align?: "start" | "center" | "end";
  contentClassName?: string;
  /** Also open after a short hover, as in the collapsed sidebar rail. */
  openOnHover?: boolean;
  /** Controls the menu from outside, e.g. the tab bar opening it when a drag ends on its tab. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Lists these entries instead, as larger, finger-sized rows, for the phone tab bar. */
  actions?: CreateAction[];
}

/** Quick "create anything" menu, shared by the sidebar and the mobile tab bar (which lists shortcuts instead). */
export function CreateMenu({
  children,
  side = "bottom",
  align = "start",
  contentClassName,
  openOnHover = false,
  actions,
  ...controlled
}: CreateMenuProps) {
  const navigate = useNavigate();
  const hover = useHoverMenu();
  const { triggerProps, contentProps } = hover;
  const open = controlled.open ?? hover.open;
  const onOpenChange = controlled.onOpenChange ?? hover.onOpenChange;
  // The tab bar's menu rises from the bottom of a phone, so a finger can drag it back down
  const phone = actions !== undefined;
  const dragRef = useDragToDismiss<HTMLDivElement>(() => phone);
  const groups = actions ? [actions] : createActions;

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={openOnHover ? false : undefined}>
      <DropdownMenuTrigger asChild {...(openOnHover && triggerProps)}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent ref={dragRef} side={side} align={align} className={contentClassName} {...(openOnHover && contentProps)}>
        {groups.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.map(({ label, to, icon: Icon }) => (
              <DropdownMenuItem
                key={to}
                onSelect={() => navigate(to)}
                className={phone ? "h-12 gap-3.5 pr-5 text-base [&_svg]:size-5" : undefined}
              >
                <Icon strokeWidth={1.8} aria-hidden="true" />
                {label}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
