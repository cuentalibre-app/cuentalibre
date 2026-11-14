import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import { Textarea } from "@cuentalibre/ui/components/input";
import { cn } from "@cuentalibre/ui/lib/cn";
import { LogoMark } from "@/components/logo";
import { Notice } from "@/components/page";
import { askHelpChat, useHelpChat, type HelpMessage } from "./help-chat-store";

/** Questions people ask while finding their way around, to start with a tap. */
const SUGGESTIONS = [
  "¿Cómo rectifico una factura?",
  "¿Dónde cierro un trimestre?",
  "¿Cómo registro un gasto con su ticket?",
  "¿Cómo importo mis facturas de otra app?",
];

/** The conversation and its composer, shared by the desktop panel and the phone's sheet. */
export function HelpChat({ className }: { className?: string }) {
  const { messages, pending, error } = useHelpChat();
  const end = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the conversation grows
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending, error]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-4">
        {messages.length === 0 ? (
          <Welcome />
        ) : (
          <ol className="m-0 flex list-none flex-col gap-4 p-0 pb-4" aria-live="polite">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            {pending && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Buscando en la guía…
              </li>
            )}
            {error && (
              <li>
                <Notice tone="warning">{error}</Notice>
              </li>
            )}
          </ol>
        )}
        <div ref={end} />
      </div>
      <Composer disabled={pending} />
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-5 pb-4">
      <div className="flex flex-col gap-2">
        <LogoMark className="h-7 self-start text-brand-mark" />
        <h2 className="m-0 text-lg font-semibold tracking-tight">¿En qué te ayudo?</h2>
        <p className="m-0 text-sm text-muted-foreground">Pregúntame cómo hacer cualquier cosa en cuentalibre.</p>
      </div>
      <ul className="m-0 flex list-none flex-col items-start gap-2 p-0" aria-label="Preguntas frecuentes">
        {SUGGESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <Button
              variant="chip"
              className="h-auto min-h-8 py-1.5 text-left whitespace-normal"
              onClick={() => askHelpChat(suggestion)}
            >
              {suggestion}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Message({ message }: { message: HelpMessage }) {
  if (message.role === "user") {
    return (
      <li className="flex justify-end">
        <p className="m-0 max-w-[85%] rounded-xl rounded-br-sm bg-muted px-3.5 py-2 text-base whitespace-pre-wrap">
          {message.text}
        </p>
      </li>
    );
  }
  return (
    <li>
      <p className="m-0 text-base leading-relaxed whitespace-pre-wrap">{message.text}</p>
    </li>
  );
}

function Composer({ disabled }: { disabled: boolean }) {
  const [text, setText] = useState("");
  const canSend = !disabled && text.trim().length > 0;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    askHelpChat(text);
    setText("");
  }

  // Enter sends, Shift+Enter breaks the line; not while an IME is composing a word
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  }

  return (
    <form onSubmit={submit} className="flex shrink-0 flex-col gap-2 px-4 pt-2 pb-3">
      <div className="relative">
        <Textarea
          autoGrow
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Escribe tu pregunta"
          aria-label="Tu pregunta"
          className="max-h-40 [overflow-y:auto] pr-12"
        />
        <Button
          type="submit"
          size="icon-sm"
          disabled={!canSend}
          aria-label="Enviar pregunta"
          className="absolute right-2 bottom-2 bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground pointer-coarse:size-8"
        >
          <ArrowUp strokeWidth={2.2} aria-hidden="true" />
        </Button>
      </div>
      {/* Required (EU AI Act art. 50): say it is an AI, and that it gives no tax advice */}
      <p className="m-0 text-xs text-muted-foreground">
        Responde una IA con la guía de cuentalibre. Puede equivocarse y no da asesoría fiscal.
      </p>
    </form>
  );
}
