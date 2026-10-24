import { cn } from "@cuentalibre/ui/lib/cn";
import { MIN_PASSWORD_LENGTH } from "./auth-api";
import { passwordStrength, type PasswordStrength } from "./password-strength";

const LEVELS: Record<PasswordStrength, { label: string; advice?: string; bar: string; text: string }> = {
  0: {
    label: "Muy corta",
    advice: `Al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    bar: "bg-destructive",
    text: "text-destructive",
  },
  1: {
    label: "Débil",
    advice: "Es fácil de adivinar. Prueba con varias palabras que no suelan ir juntas.",
    bar: "bg-destructive",
    text: "text-destructive",
  },
  2: {
    label: "Aceptable",
    advice: "Un poco más larga será más difícil de adivinar.",
    bar: "bg-warning",
    text: "text-warning",
  },
  3: { label: "Buena", bar: "bg-success", text: "text-success" },
  4: { label: "Muy buena", bar: "bg-success", text: "text-success" },
};

/** The hint under a new password: the minimum length, then advice to make it harder to guess. */
export function newPasswordHint(password: string) {
  return password ? LEVELS[passwordStrength(password)].advice : `Al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
}

/** Four bars and a word for how hard the new password is to guess; nothing until something is typed. */
export function PasswordMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = passwordStrength(password);
  const level = LEVELS[strength];
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              step <= Math.max(strength, 1) ? level.bar : "bg-muted",
            )}
          />
        ))}
      </div>
      <span role="status" className={cn("text-xs font-medium", level.text)}>
        {level.label}
      </span>
    </div>
  );
}
