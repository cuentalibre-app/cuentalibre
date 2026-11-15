import { helpChatRequestSchema } from "@cuentalibre/contracts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import { AiError } from "../ai";
import { recordQuestion, releaseQuestion, reserveQuestion } from "../ai/questions";
import type { AppEnv } from "../context";
import { reportError } from "../error-reporting";
import { ApiError, errorContent } from "../errors";
import { requireOrganization } from "../middleware";

const ask = createRoute({
  method: "post",
  path: "/help-chat",
  tags: ["Help chat"],
  summary: "Ask the help chat how to use cuentalibre",
  description:
    "Send the conversation so far, ending with the question: the server keeps none of it. An AI model answers " +
    "from cuentalibre's documentation, never from the organization's data, and gives no tax advice. The answer " +
    "streams as server-sent events: `text` ones carry the next piece of it, as a JSON string; then `done`, or " +
    "`error` with `{ code, message }` if the provider failed halfway. The server may limit the questions an " +
    "organization asks a day (Spain's time).",
  middleware: [requireOrganization] as const,
  request: { body: { required: true, content: { "application/json": { schema: helpChatRequestSchema } } } },
  responses: {
    200: { description: "The answer, as it is written", content: { "text/event-stream": { schema: z.string() } } },
    429: errorContent("The organization has asked today's questions (`ai_quota_exceeded`)"),
    502: errorContent("The AI provider failed (`ai_failed`)"),
    503: errorContent("This server has no help chat set up (`ai_unavailable`)"),
    401: errorContent("Not signed in"),
    403: errorContent("No active organization, or the user doesn't belong to it"),
  },
});

const providerFailed = () => new ApiError(502, "ai_failed", "The help chat couldn't answer. Try again later.");

export const helpChatRoutes = new OpenAPIHono<AppEnv>().openapi(ask, async (c) => {
  const chat = c.get("chat");
  if (!chat) throw new ApiError(503, "ai_unavailable", "This server has no help chat set up.");
  const db = c.get("db");
  const organizationId = c.get("organizationId");
  const { messages } = c.req.valid("json");

  const id = await reserveQuestion(db, organizationId, chat.provider.model, chat.dailyQuestions);
  let events;
  try {
    events = await chat.provider.stream({ system: chat.prompt, messages, signal: c.req.raw.signal });
  } catch (error) {
    await releaseQuestion(db, organizationId, id);
    if (!(error instanceof AiError)) throw error;
    console.error(`The help chat failed: ${error.message}`);
    throw providerFailed();
  }

  return streamSSE(c, async (stream) => {
    try {
      for await (const event of events) {
        if (event.type === "text") await stream.writeSSE({ event: "text", data: JSON.stringify(event.text) });
        else await recordQuestion(db, organizationId, id, event.usage);
      }
      await stream.writeSSE({ event: "done", data: "{}" });
    } catch (error) {
      // The person left: the provider's call was stopped with the request
      if (c.req.raw.signal.aborted) return;
      if (error instanceof AiError) console.error(`The help chat failed while answering: ${error.message}`);
      else {
        console.error(error);
        reportError(error, { method: "POST", route: "/v1/help-chat" });
      }
      const { code, message } = providerFailed();
      await stream.writeSSE({ event: "error", data: JSON.stringify({ code, message }) });
    }
  });
});
