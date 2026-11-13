import type { PurchaseExtraction } from "@cuentalibre/contracts";
import { newId } from "@cuentalibre/core";
import { beforeEach, describe, expect, it } from "vitest";
import { aiProtocol, createAiProvider } from "./ai";
import type { ModelAnswer } from "./ai/answer";
import { toDraft } from "./ai/answer";
import { sniffType } from "./ai/extract";
import { parseJsonMessage } from "./ai/openai";
import { createApp } from "./app";
import { createAuth } from "./auth";
import { loadEnv, type Env } from "./env";
import { accountMailer, createOrganization, db, env, mailer, signUp, storage, type Client } from "./test/harness";
import { send } from "./test/sync";

/** A one-page PDF whose text layer holds these lines (ASCII), or none, like a scan. */
function pdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const content = lines.length
    ? `BT /F1 12 Tf 50 780 Td ${lines.map((line, i) => `${i ? "0 -16 Td " : ""}(${line}) Tj`).join(" ")} ET`
    : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = out.length;
  out +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const INVOICE_TEXT = [
  "Brisa Telecom SL - CIF B12345674 - Calle Mayor 1, 28001 Madrid",
  "Factura F-118 Fecha 07/10/2026 Vencimiento 07/11/2026",
  "Fibra y movil octubre Base 100,00 IVA 21% 21,00 Total 121,00 EUR",
];
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);

const answer = (fields: Partial<ModelAnswer> = {}): ModelAnswer => ({
  documentType: "invoice",
  supplier: {
    name: "Brisa Telecom SL",
    taxId: "B-12345674",
    address: "Calle Mayor 1",
    postalCode: "28001",
    city: "Madrid",
    countryCode: "ES",
  },
  number: "F-118",
  issueDate: "2026-10-07",
  dueDate: "2026-11-07",
  concept: "Fibra y móvil octubre",
  currency: "EUR",
  vatLines: [{ ratePercent: 21, base: 100, vat: 21, surchargePercent: null, surcharge: null }],
  withholding: null,
  total: 121,
  ...fields,
});

/** A fake model: records what it was sent and replies with `reply`. */
const provider = {
  requests: [] as { url: string; headers: Headers; body: Record<string, unknown> }[],
  reply: (_body: Record<string, unknown>): Response => new Response(null, { status: 500 }),
  fetch: (async (input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    provider.requests.push({ url: String(input), headers: new Headers(init?.headers), body });
    return provider.reply(body);
  }) as typeof fetch,
};

const openAiReply = (content: unknown) => () =>
  Response.json({
    choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
  });
const anthropicReply = (input: unknown) => () =>
  Response.json({ content: [{ type: "tool_use", id: "toolu_1", name: "record_purchase", input }] });

function appWith(ai: Pick<Env, "AI_MODEL" | "AI_API_KEY" | "AI_BASE_URL">) {
  return createApp({
    db,
    auth: createAuth(db, env, accountMailer),
    env,
    storage,
    mailer,
    ai: createAiProvider(ai, provider.fetch),
  });
}

const openAiApp = appWith({ AI_MODEL: "qwen2.5vl", AI_BASE_URL: "http://ollama.test:11434/v1" });
const anthropicApp = appWith({ AI_MODEL: "claude-haiku-4-5", AI_API_KEY: "sk-ant-test" });

async function memberOf(app: ReturnType<typeof createApp>) {
  const user = await signUp("Ana", app);
  await createOrganization(user, "Ana SL");
  return user;
}

async function upload(user: Client, body: Uint8Array<ArrayBuffer>, type = "application/pdf") {
  const form = new FormData();
  form.set("file", new File([body], "factura", { type }));
  const response = await user.request("/v1/files", { method: "POST", form });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

const extract = (user: Client, fileId: string) =>
  user.request("/v1/purchases/extract", { method: "POST", body: { fileId } });

beforeEach(() => {
  provider.requests.length = 0;
});

describe("aiProtocol", () => {
  it("speaks Anthropic's API only on its host", () => {
    expect(aiProtocol({ baseUrl: "https://api.anthropic.com/v1" })).toBe("anthropic");
    expect(aiProtocol({ baseUrl: "http://localhost:11434/v1" })).toBe("openai");
    expect(aiProtocol({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-ant-misplaced" })).toBe("openai");
  });

  it("picks the provider by the key without a base URL", () => {
    expect(aiProtocol({ apiKey: "sk-ant-api03-x" })).toBe("anthropic");
    expect(aiProtocol({ apiKey: "sk-proj-x" })).toBe("openai");
  });
});

describe("AI settings", () => {
  it("are off without a model", () => {
    expect(createAiProvider(loadEnv({}))).toBeNull();
  });

  it("tell the app whether documents can be read", async () => {
    expect(await (await openAiApp.request("/v1/sign-in-methods")).json()).toMatchObject({ ai: true });
  });

  it("need a key for OpenAI or Anthropic, or a base URL for another provider", () => {
    expect(() => loadEnv({ AI_MODEL: "gpt-4.1-mini" })).toThrow(/AI_MODEL needs AI_API_KEY/);
    expect(() => loadEnv({ AI_MODEL: "qwen2.5vl", AI_BASE_URL: "http://localhost:11434/v1" })).not.toThrow();
  });
});

describe("the model's answer", () => {
  it("becomes a draft in cents and fractions", () => {
    expect(
      toDraft(
        answer({
          vatLines: [{ ratePercent: 21, base: 1234.56, vat: 259.26, surchargePercent: 5.2, surcharge: 64.2 }],
          withholding: { ratePercent: 15, amount: 185.18 },
          total: 1372.84,
        }),
      ),
    ).toMatchObject({
      kind: "invoice",
      supplier: { taxId: "B12345674", country: "España" },
      vatBreakdown: [{ rate: 0.21, base: 123456, vat: 25926, surchargeRate: 0.052, surcharge: 6420 }],
      withholding: { rate: 0.15, amount: 18518 },
      total: 137284,
    });
  });

  it("drops dates that don't exist and refunds the withholding of a credit note", () => {
    const draft = toDraft(
      answer({
        issueDate: "2026-02-30",
        dueDate: "07/11/2026",
        vatLines: [{ ratePercent: 21, base: -100, vat: -21, surchargePercent: null, surcharge: null }],
        withholding: { ratePercent: 15, amount: 15 },
        total: -106,
      }),
    );
    expect(draft).toMatchObject({ issuedOn: null, dueOn: null, withholding: { amount: -1500 } });
  });

  it("is read without the code fence some local models add", () => {
    expect(parseJsonMessage('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("tells files by their bytes", () => {
    expect(sniffType(pdf([]))).toBe("pdf");
    expect(sniffType(JPEG)).toBe("image/jpeg");
    expect(sniffType(new TextEncoder().encode("<html>"))).toBeNull();
  });
});

describe("POST /v1/purchases/extract", () => {
  it("is unavailable without a model", async () => {
    const user = await signUp("Ana");
    await createOrganization(user, "Ana SL");
    const response = await extract(user, newId());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "ai_unavailable" } });
  });

  it("sends a PDF's text to an OpenAI-compatible model and returns a draft with its supplier", async () => {
    const ana = await memberOf(openAiApp);
    const brisa = { id: newId(), name: "Brisa Telecom SL", taxId: "B12345674" };
    expect((await send(ana, [{ type: "create", entity: "suppliers", data: brisa }])).status).toBe(200);
    provider.reply = openAiReply(answer());

    const response = await extract(ana, await upload(ana, pdf(INVOICE_TEXT)));
    expect(response.status).toBe(200);
    expect((await response.json()) as PurchaseExtraction).toEqual({
      draft: {
        kind: "invoice",
        supplier: {
          name: "Brisa Telecom SL",
          taxId: "B12345674",
          address: "Calle Mayor 1",
          postalCode: "28001",
          city: "Madrid",
          country: "España",
        },
        number: "F-118",
        issuedOn: "2026-10-07",
        dueOn: "2026-11-07",
        concept: "Fibra y móvil octubre",
        currency: "EUR",
        vatBreakdown: [{ rate: 0.21, base: 10000, vat: 2100, surchargeRate: 0, surcharge: 0 }],
        withholding: null,
        total: 12100,
      },
      supplierId: brisa.id,
      issues: [],
      source: "text",
    });

    const [request] = provider.requests;
    expect(request!.url).toBe("http://ollama.test:11434/v1/chat/completions");
    expect(request!.headers.has("authorization")).toBe(false);
    expect(request!.body).toMatchObject({
      model: "qwen2.5vl",
      response_format: { type: "json_schema", json_schema: { strict: true } },
    });
    const messages = request!.body.messages as { role: string; content: string }[];
    expect(messages[1]!.content).toContain("Factura F-118 Fecha 07/10/2026");
  });

  it("sends a PDF without text, like a scan, as the file itself", async () => {
    const ana = await memberOf(openAiApp);
    provider.reply = openAiReply(answer());
    const response = await extract(ana, await upload(ana, pdf([])));
    expect(response.status).toBe(200);
    expect(((await response.json()) as PurchaseExtraction).source).toBe("pdf");
    const messages = provider.requests[0]!.body.messages as {
      content: { type: string; file?: { file_data: string } }[];
    }[];
    expect(messages[1]!.content[1]!.file!.file_data).toMatch(/^data:application\/pdf;base64,JVBERi/);
  });

  it("sends a photo to Anthropic with its key and reads the forced tool call, flagging what doesn't add up", async () => {
    const ana = await memberOf(anthropicApp);
    provider.reply = anthropicReply(
      answer({
        documentType: "simplifiedInvoice",
        supplier: { name: "Bar Pepe", taxId: null, address: null, postalCode: null, city: null, countryCode: null },
        number: null,
        total: 125,
      }),
    );

    const response = await extract(ana, await upload(ana, JPEG, "image/jpeg"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as PurchaseExtraction;
    expect(body).toMatchObject({ draft: { kind: "ticket", total: 12500 }, supplierId: null, source: "image" });
    expect(body.issues).toEqual([{ field: "total", code: "mismatch" }]);

    const [request] = provider.requests;
    expect(request!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request!.headers.get("x-api-key")).toBe("sk-ant-test");
    expect(request!.body).toMatchObject({
      model: "claude-haiku-4-5",
      tool_choice: { type: "tool", name: "record_purchase" },
    });
    const content = (request!.body.messages as { content: { type: string; source?: unknown }[] }[])[0]!.content;
    expect(content[0]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: "/9j/4AAQSkZJRg==" },
    });
  });

  it("only reads PDFs and images", async () => {
    const ana = await memberOf(openAiApp);
    const response = await extract(ana, await upload(ana, new TextEncoder().encode("hola"), "text/plain"));
    expect(response.status).toBe(415);
    expect(provider.requests).toHaveLength(0);
  });

  it("can't read another organization's file", async () => {
    const ana = await memberOf(openAiApp);
    const bea = await memberOf(openAiApp);
    const response = await extract(bea, await upload(ana, pdf(INVOICE_TEXT)));
    expect(response.status).toBe(404);
  });

  it("answers 502 when the provider fails or its answer isn't the schema", async () => {
    const ana = await memberOf(openAiApp);
    const fileId = await upload(ana, pdf(INVOICE_TEXT));

    provider.reply = () => Response.json({ error: { message: "overloaded" } }, { status: 529 });
    let response = await extract(ana, fileId);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "ai_failed" } });

    provider.reply = openAiReply({ total: "ciento veintiuno" });
    response = await extract(ana, fileId);
    expect(response.status).toBe(502);

    provider.reply = openAiReply("Lo siento, no puedo leerlo.");
    response = await extract(ana, fileId);
    expect(response.status).toBe(502);
  });
});
