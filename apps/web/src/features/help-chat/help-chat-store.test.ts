import { describe, expect, it } from "vitest";
import { ApiError } from "@/data/api";
import { conversationFor, helpChatError, type HelpMessage } from "./help-chat-store";

const user = (id: number, text: string): HelpMessage => ({ id, role: "user", text });
const assistant = (id: number, text: string): HelpMessage => ({ id, role: "assistant", text });

describe("conversationFor", () => {
  it("sends the conversation with the question last", () => {
    expect(
      conversationFor([user(1, "¿Cómo rectifico?"), assistant(2, "Abre la factura."), user(3, "¿Y si está pagada?")]),
    ).toEqual([
      { role: "user", content: "¿Cómo rectifico?" },
      { role: "assistant", content: "Abre la factura." },
      { role: "user", content: "¿Y si está pagada?" },
    ]);
  });

  it("leaves out questions that got no answer, so messages take turns", () => {
    expect(conversationFor([user(1, "Hola"), user(2, "¿Dónde cierro un trimestre?")])).toEqual([
      { role: "user", content: "¿Dónde cierro un trimestre?" },
    ]);
  });

  it("sends the latest exchanges only, starting with a question", () => {
    const messages = Array.from({ length: 30 }, (_, i) => (i % 2 ? assistant(i, `a${i}`) : user(i, `q${i}`)));
    messages.push(user(30, "q30"));
    const sent = conversationFor(messages);
    expect(sent).toHaveLength(21);
    expect(sent[0]).toEqual({ role: "user", content: "q10" });
    expect(sent.at(-1)).toEqual({ role: "user", content: "q30" });
  });
});

describe("helpChatError", () => {
  it("tells when today's questions are used up", () => {
    expect(helpChatError(new ApiError(429, "ai_quota_exceeded", ""))).toMatch(/mañana/);
    expect(helpChatError(new Error("offline"))).toMatch(/Vuelve a intentarlo/);
  });
});
