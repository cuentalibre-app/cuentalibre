import { describe, expect, it } from "vitest";
import { passwordResetEmail, verificationCodeEmail } from "./account-emails";

describe("account emails in HTML", () => {
  it("escapes what people typed", () => {
    const { html } = verificationCodeEmail({ name: "<b>Ana</b> & co", email: "ana@example.com" }, "123456");
    expect(html).toContain("Hola, &lt;b&gt;Ana&lt;/b&gt; &amp; co:");
    expect(html).not.toContain("<b>Ana</b>");
  });

  it("links the button and the fallback to the reset link", () => {
    const url = "https://app.example.com/v1/auth/reset-password/abc?callbackURL=x&y=1";
    const { html, text } = passwordResetEmail({ name: "Ana", email: "ana@example.com" }, url);
    expect(
      html!.match(/href="https:\/\/app\.example\.com\/v1\/auth\/reset-password\/abc\?callbackURL=x&amp;y=1"/g),
    ).toHaveLength(2);
    expect(text).toContain(url);
  });
});
