import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@cuentalibre/ui/components/input";
import { Button } from "@cuentalibre/ui/components/button";

/** A password field with a button to show what has been typed. */
export function PasswordInput(props: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-11" />
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute inset-y-0 right-1 my-auto"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        onClick={() => setVisible((shown) => !shown)}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
