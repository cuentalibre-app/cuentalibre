import { BotMessageSquare } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { HELP_CHAT_PANEL_ID } from "./help-chat-panel";
import { toggleHelpChat, useHelpChat, useHelpChatAvailable } from "./help-chat-store";

/**
 * Opens and closes the assistant docked on the right, from the top right of every page header,
 * next to where the panel appears. Lit while the panel is open; desktop only.
 */
export function HelpChatToggle({ className }: { className?: string }) {
  const available = useHelpChatAvailable();
  const { open } = useHelpChat();
  if (!available) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Asistente"
            aria-expanded={open}
            aria-controls={HELP_CHAT_PANEL_ID}
            onClick={toggleHelpChat}
            className={cn("hidden lg:inline-flex", open && "border-input bg-muted", className)}
          >
            <BotMessageSquare strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{open ? "Cerrar el asistente" : "Asistente"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
