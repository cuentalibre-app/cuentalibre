import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
  it("is 0 below the minimum length", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("Ab1!xyz")).toBe(0);
  });

  it("sees through common words, years, repeats and runs", () => {
    for (const password of [
      "hola12345678",
      "password1234",
      "Contraseña1!",
      "aaaaaaaaaaaa",
      "qwertyuiop",
      "abcdefgh2024",
    ])
      expect(passwordStrength(password), password).toBe(1);
  });

  it("rates longer, varied passwords higher", () => {
    expect(passwordStrength("juanperez88")).toBe(2);
    expect(passwordStrength("gatoverde-77")).toBe(3);
    expect(passwordStrength("tortuga-azul-salta-el-río")).toBe(4);
    expect(passwordStrength("Xk9#mQ2$vL7p")).toBe(4);
  });
});
