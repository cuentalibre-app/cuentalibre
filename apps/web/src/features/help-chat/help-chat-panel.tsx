import { PanelRightClose, SquarePen } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { HelpChat } from "./help-chat";
import { resetHelpChat, setHelpChatOpen, useHelpChat } from "./help-chat-store";

export const HELP_CHAT_PANEL_ID = "help-chat-panel";

/**
 * The assistant on the right of the page on desktop. On wide screens it docks beside the content,
 * widening from nothing so the page narrows along with it; where that would leave the page too
 * narrow for its tables, it slides in over the content instead.
 */
export function HelpChatPanel({ className }: { className?: string }) {
  const { open, messages } = useHelpChat();
  // The expanded sidebar, a page wide enough for the invoice table, and the panel
  const docked = useMediaQuery("(min-width: 105rem)");

  return (
    <aside
      id={HELP_CHAT_PANEL_ID}
      aria-label="Asistente"
      inert={!open}
      onKeyDown={(e) => e.key === "Escape" && setHelpChatOpen(false)}
      className={cn(
        "top-[calc(var(--demo-banner-h,0px)+0.5rem)] h-[calc(100dvh-var(--demo-banner-h,0px)-1rem)] duration-300 ease-out motion-reduce:transition-none",
        docked
          ? cn(
              "sticky my-2 shrink-0 self-start overflow-hidden transition-[width,margin,opacity]",
              open ? "mr-2 w-96 opacity-100" : "mr-0 w-0 opacity-0",
            )
          : cn(
              "fixed right-2 z-20 w-96 rounded-xl shadow-floating transition-[translate,opacity]",
              open ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+1rem)] opacity-0",
            ),
        className,
      )}
    >
      {/* Fixed width, so the conversation doesn't reflow while the docked panel widens */}
      <div className="flex h-full w-96 flex-col rounded-xl border border-border bg-background">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-divider pr-2 pl-4">
          <h2 className="m-0 text-md font-semibold tracking-tight">Asistente</h2>
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-0.5">
              {messages.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Nueva conversación" onClick={resetHelpChat}>
                      <SquarePen strokeWidth={1.8} aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Nueva conversación</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cerrar el asistente"
                    onClick={() => setHelpChatOpen(false)}
                  >
                    <PanelRightClose strokeWidth={1.8} aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Cerrar</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <HelpChat />
      </div>
    </aside>
  );
}
