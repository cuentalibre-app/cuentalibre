import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { mainNav, secondaryNav } from "@/components/layout/nav";

// Sections that don't fit in the mobile tab bar
const groups = [
  ...mainNav
    .filter((item) => !["/", "/ventas", "/impuestos"].includes(item.to))
    .map((item) => ({ title: item.label, links: item.children ?? [item] })),
  { title: "Gestión", links: secondaryNav },
];

export function MorePage() {
  return (
    <div className="flex flex-col gap-6 px-5 pt-6">
      <h1 className="m-0 text-2xl font-semibold tracking-tight">Más</h1>
      {groups.map((group) => (
        <section key={group.title} className="flex flex-col">
          <h2 className="m-0 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h2>
          {group.links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex min-h-12 items-center justify-between border-b border-divider text-md text-foreground no-underline"
            >
              {link.label}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
