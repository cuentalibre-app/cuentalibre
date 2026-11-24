import * as Sentry from "@sentry/node";
import { DrizzleQueryError } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Env } from "./env";
import { reportError, startErrorReporting, stopErrorReporting } from "./error-reporting";

describe("what Sentry is sent", () => {
  // Nothing listens on port 9: envelopes are caught as they leave, and their sending fails
  startErrorReporting({ SENTRY_DSN: "http://public@127.0.0.1:9/1", NODE_ENV: "test" } as Env);
  const sent: string[] = [];
  Sentry.getClient()!.on("beforeEnvelope", (envelope) => void sent.push(JSON.stringify(envelope)));
  afterAll(stopErrorReporting);

  it("has a failed query's SQL and error code, not its parameters, the database's detail or message", async () => {
    const cause = Object.assign(new Error('invalid input syntax for type integer: "B12345678"'), {
      code: "22P02",
      table: "contact",
      detail: "Key (tax_id)=(B12345678) already exists.",
    });
    reportError(new DrizzleQueryError('select * from "contact" where "tax_id" = $1', ["B12345678"], cause));
    await Sentry.flush(1000);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain(
      'Failed query: select * from \\"contact\\" where \\"tax_id\\" = $1 (code 22P02, table contact)',
    );
    expect(sent[0]).not.toContain("B12345678");
  });
});
