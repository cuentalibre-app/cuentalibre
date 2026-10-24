import { MIN_PASSWORD_LENGTH } from "./auth-api";

/** 0: too short, 1: weak, 2: fair, 3: good, 4: very good. */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

/** Words that open so many passwords that they add almost nothing; matched lowercase, without accents. */
const COMMON_WORDS = [
  "password",
  "contrasena",
  "clave",
  "qwerty",
  "asdf",
  "admin",
  "hola",
  "adios",
  "amor",
  "teamo",
  "iloveyou",
  "welcome",
  "bienvenido",
  "letmein",
  "dragon",
  "monkey",
  "futbol",
  "football",
  "barcelona",
  "madrid",
  "espana",
  "cuentalibre",
];

/** Rows of a Spanish keyboard, whose runs (`qwer`, `asdf`) are as easy to guess as `abcd`. */
const KEYBOARD_ROWS = ["1234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm"];

/**
 * How hard the password is to guess, as a rough estimate for a meter while typing. Common
 * words, years, repeated characters and runs like `abcd`, `1234` or `qwer` count as one
 * character each; the rest adds bits by the kinds of characters used. The server has the
 * final say: it refuses passwords found in data breaches.
 */
export function passwordStrength(password: string): PasswordStrength {
  if (password.length < MIN_PASSWORD_LENGTH) return 0;
  const bits = effectiveLength(password) * Math.log2(alphabetSize(password));
  if (bits < 40) return 1;
  if (bits < 60) return 2;
  if (bits < 75) return 3;
  return 4;
}

/** How many characters really count, once the predictable stretches are each taken as one. */
function effectiveLength(password: string) {
  let text = password.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const word of COMMON_WORDS) text = text.replaceAll(word, "\u0001");
  text = text.replace(/(19|20)\d\d/g, "\u0001");

  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const previous = text[i - 1];
    const current = text[i]!;
    // A character that repeats or continues a run adds nothing beyond the run's first two
    const continues =
      previous !== undefined &&
      (current === previous || isStep(previous, current)) &&
      (text[i - 2] === undefined || current === text[i - 2] || isStep(text[i - 2]!, previous));
    if (!continues) length++;
  }
  return length;
}

/** Whether `next` comes right after or right before `previous` in the alphabet, the digits, or a keyboard row. */
function isStep(previous: string, next: string) {
  const distance = next.charCodeAt(0) - previous.charCodeAt(0);
  if (/[a-z0-9]/.test(previous) && /[a-z0-9]/.test(next) && Math.abs(distance) === 1) return true;
  return KEYBOARD_ROWS.some((row) => {
    const at = row.indexOf(previous);
    return at >= 0 && (row[at + 1] === next || row[at - 1] === next);
  });
}

/** How many characters each position could have been, by the kinds of characters used. */
function alphabetSize(password: string) {
  let size = 0;
  if (/\p{Ll}/u.test(password)) size += 27;
  if (/\p{Lu}/u.test(password)) size += 27;
  if (/\d/.test(password)) size += 10;
  if (/[^\p{L}\d]/u.test(password)) size += 33;
  return Math.max(size, 2);
}
