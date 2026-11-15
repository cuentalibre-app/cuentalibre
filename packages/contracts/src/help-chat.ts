import { z } from "zod";

/** Longest question or answer the help chat takes, in characters. */
export const HELP_CHAT_MAX_MESSAGE = 4000;
/** Most messages sent with a question: ten exchanges before it. The app leaves older ones out. */
export const HELP_CHAT_MAX_MESSAGES = 21;

export const helpChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(HELP_CHAT_MAX_MESSAGE),
});
export type HelpChatMessage = z.infer<typeof helpChatMessageSchema>;

/**
 * Where the person is asking from, so the answer names the buttons they see: the app lays out
 * its navigation differently on a phone and on a computer.
 */
export const helpChatScreenSchema = z.object({
  device: z.enum(["phone", "desktop"]),
  /** The app's page, without its query: "/ventas/facturas". */
  path: z
    .string()
    .max(200)
    .regex(/^\/[^\s?#]*$/),
});
export type HelpChatScreen = z.infer<typeof helpChatScreenSchema>;

/**
 * A question to the help chat, with the conversation before it: the server keeps none.
 * Messages take turns, starting and ending with the user's.
 */
export const helpChatRequestSchema = z.object({
  messages: z
    .array(helpChatMessageSchema)
    .min(1)
    .max(HELP_CHAT_MAX_MESSAGES)
    .refine((messages) => messages.every((message, i) => message.role === (i % 2 === 0 ? "user" : "assistant")), {
      message: "Messages take turns, starting with the user's.",
    })
    .refine((messages) => messages.at(-1)?.role === "user", { message: "The last message is the user's question." }),
  screen: helpChatScreenSchema.optional(),
});
export type HelpChatRequest = z.infer<typeof helpChatRequestSchema>;
