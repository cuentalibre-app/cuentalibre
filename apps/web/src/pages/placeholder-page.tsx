import { Link } from "react-router";
import { buttonVariants } from "@cuentalibre/ui/components/button";
import { Page, PageHeader } from "@/components/page";

/** Stand-in for sections that aren't built yet. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <Page>
      <PageHeader title={title} description="Esta sección todavía no está disponible." />
      <Link to="/" className={buttonVariants({ variant: "secondary", className: "self-start" })}>
        Volver al inicio
      </Link>
    </Page>
  );
}
