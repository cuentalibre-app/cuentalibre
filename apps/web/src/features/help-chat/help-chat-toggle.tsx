import { BotMessageSquare } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cuentalibre/ui/components/tooltip";
import { cn } from "@cuentalibre/ui/lib/cn";
import { HELP_CHAT_PANEL_ID } from "./help-chat-panel";
import { toggleHelpChat, useHelpChat, useHelpChatAvailable } from "./help-chat-store";

/**
 * Opens the assistant from every page header (top right on desktop, first of the actions on phones): docked on the right on desktop,
 * lit while it is open; as a sheet over the page on phones.
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
            className={cn(open && "lg:border-input lg:bg-muted", className)}
          >
            <BotMessageSquare strokeWidth={1.8} aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{open ? "Cerrar el asistente" : "Asistente"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
