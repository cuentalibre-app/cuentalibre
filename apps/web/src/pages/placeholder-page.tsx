import { Link } from "react-router";
import { cn } from "@cuentalibre/ui/lib/cn";
import { buttonVariants } from "@cuentalibre/ui/components/button";

/** Stand-in for sections that aren't built yet. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-6 lg:px-8 lg:pt-6">
      <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
      <p className="m-0 text-muted-foreground">Esta sección todavía no está disponible.</p>
      <Link to="/" className={cn(buttonVariants({ variant: "secondary" }), "self-start no-underline")}>
        Volver al inicio
      </Link>
    </div>
  );
}
