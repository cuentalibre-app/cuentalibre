import { Link } from "react-router";

/** Stand-in for sections that aren't built yet. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-6 lg:px-8 lg:pt-6">
      <h1 className="m-0 text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h1>
      <p className="m-0 text-muted-foreground">Esta sección todavía no está disponible.</p>
      <Link to="/" className="font-medium text-primary no-underline hover:text-primary-hover">
        Volver al inicio
      </Link>
    </div>
  );
}
