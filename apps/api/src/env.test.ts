import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("takes the API and the web app from PUBLIC_URL when they share an origin", () => {
    const env = loadEnv({ PUBLIC_URL: "https://cuentas.example.com/" });
    expect(env.BETTER_AUTH_URL).toBe("https://cuentas.example.com");
    expect(env.WEB_ORIGIN).toBe("https://cuentas.example.com");
  });

  it("lets BETTER_AUTH_URL and WEB_ORIGIN still be set apart", () => {
    const env = loadEnv({
      PUBLIC_URL: "https://cuentas.example.com",
      BETTER_AUTH_URL: "https://api.example.com",
      WEB_ORIGIN: "https://app.example.com",
    });
    expect(env.BETTER_AUTH_URL).toBe("https://api.example.com");
    expect(env.WEB_ORIGIN).toBe("https://app.example.com");
  });

  it("keeps the development defaults without any", () => {
    const env = loadEnv({});
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.WEB_ORIGIN).toBe("http://localhost:5173");
  });
});
