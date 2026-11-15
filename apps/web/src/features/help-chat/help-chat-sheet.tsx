import { Sheet, SheetContent } from "@cuentalibre/ui/components/sheet";
import { HelpChat } from "./help-chat";
import { setHelpChatSheetOpen, useHelpChat } from "./help-chat-store";

/** The assistant on phones: a tall sheet over the page, opened from the page headers. */
export function HelpChatSheet() {
  const { sheetOpen } = useHelpChat();
  return (
    <Sheet open={sheetOpen} onOpenChange={setHelpChatSheetOpen}>
      {/* The chat scrolls on its own and keeps its composer at the bottom, so the sheet's body only frames it */}
      <SheetContent title="Asistente" className="h-[85dvh]" bodyClassName="flex flex-col overflow-hidden px-2 pb-0">
        <HelpChat />
      </SheetContent>
    </Sheet>
  );
}
