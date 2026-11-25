import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { moreNav } from "@/components/layout/nav";
import { LegalLinks } from "@/components/legal-links";
import { Page, PageHeader } from "@/components/page";

const row = "flex min-h-12 items-center justify-between border-b border-divider text-md text-foreground no-underline";

/** The "Más" list as a page, for direct links; the tab bar opens the same list as a sheet. */
export function MorePage() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageHeader title={t("navigation.labels.more")} />
      {moreNav.map((entry) =>
        entry.kind === "link" ? (
          <Link key={entry.item.to} to={entry.item.to} className={row}>
            {t(entry.item.labelKey)}
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        ) : (
          <section key={entry.title} className="flex flex-col">
            <h2 className="m-0 pb-1.5 text-xs font-medium text-muted-foreground">{t(entry.titleKey)}</h2>
            {entry.links.map((link) => (
              <Link key={link.to} to={link.to} className={row}>
                {t(link.labelKey)}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </section>
        ),
      )}
      <LegalLinks />
    </Page>
  );
}
