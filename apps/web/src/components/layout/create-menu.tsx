import { Fragment, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@fiscalia/ui/components/dropdown-menu";
import { createActions } from "./nav";

interface CreateMenuProps {
  /** The trigger element; it must be a single button. */
  children: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  contentClassName?: string;
}

/** Quick "create anything" menu, shared by the sidebar and the mobile tab bar. */
export function CreateMenu({ children, side = "bottom", align = "start", contentClassName }: CreateMenuProps) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className={contentClassName}>
        {createActions.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <DropdownMenuSeparator />}
            {group.map(({ label, to, icon: Icon }) => (
              <DropdownMenuItem key={to} onSelect={() => navigate(to)}>
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
