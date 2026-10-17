import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Bell, Check, PackageX } from "lucide-react";
import { Button } from "@fiscalia/ui/components/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@fiscalia/ui/components/popover";
import { cn } from "@fiscalia/ui/lib/cn";
import { PRODUCTS_PATH, formatQuantity, productPath, productStock } from "@/features/catalog/catalog-model";
import { useCatalog } from "@/features/catalog/catalog-store";

const STORAGE_KEY = "fiscalia:read-notifications";

interface Notice {
  /** Changes with the alarm level, so running out after a read "low" warning notifies again. */
  id: string;
  productId: string;
  title: string;
  detail: string;
  out: boolean;
}

function readStored(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Stock alarms that ask to warn on the home page, with the ones the user has marked as read. */
function useNotices() {
  const { products, movements } = useCatalog();
  const [read, setRead] = useState(readStored);

  const notices = useMemo(
    () =>
      products.flatMap((p): Notice[] => {
        const alarm = p.stock?.alarm;
        if (!p.active || !alarm?.dashboard) return [];
        const s = productStock(p, movements);
        if (!s || !s.alarm || s.alarm === "ok") return [];
        const out = s.alarm === "out";
        return [
          {
            id: `stock:${p.id}:${s.alarm}`,
            productId: p.id,
            title: p.name,
            detail: out ? "Agotado" : `Quedan ${formatQuantity(s.stock)} (mínimo ${formatQuantity(alarm.minUnits)})`,
            out,
          },
        ];
      }),
    [products, movements],
  );

  // Forget reads of alarms that have stopped, so the next time stock runs low it warns again
  useEffect(() => {
    const active = new Set(notices.map((n) => n.id));
    if (read.some((id) => !active.has(id))) setRead(read.filter((id) => active.has(id)));
  }, [notices, read]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(read));
    } catch {
      // Storage can be unavailable; reads then last until reload
    }
  }, [read]);

  const unread = notices.filter((n) => !read.includes(n.id));
  const markRead = (ids: string[]) => setRead((r) => [...new Set([...r, ...ids])]);
  return { unread, markRead };
}

/** Bell that opens the pending notices; each one stays until the user marks it as read. */
export function Notifications({ className }: { className?: string }) {
  const { unread, markRead } = useNotices();
  const count = unread.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={count ? `Avisos, ${count} sin leer` : "Avisos"}
          className={cn("relative border-border", className)}
        >
          <Bell strokeWidth={1.8} aria-hidden="true" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warning px-1 text-2xs font-semibold text-warning-foreground ring-2 ring-background">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-[min(24rem,calc(100vw-2rem))] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
          <h2 className="m-0 text-base font-semibold">Avisos</h2>
          {count > 1 && (
            <button
              type="button"
              onClick={() => markRead(unread.map((n) => n.id))}
              className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Marcar todos como leídos
            </button>
          )}
        </div>

        {count === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-sm text-muted-foreground">No tienes avisos pendientes.</p>
        ) : (
          <ul className="m-0 flex max-h-[60vh] list-none flex-col overflow-y-auto p-1.5">
            {unread.map((n) => (
              <li key={n.id} className="flex items-start gap-3 rounded-lg px-2.5 py-2.5 hover:bg-muted">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning">
                  <PackageX className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    {n.out ? "Producto agotado" : "Poco stock"}
                  </span>
                  <PopoverClose asChild>
                    <Link
                      to={productPath(n.productId)}
                      className="font-semibold text-foreground no-underline hover:underline"
                    >
                      {n.title}
                    </Link>
                  </PopoverClose>
                  <span className={n.out ? "text-destructive" : "text-muted-foreground"}>{n.detail}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Marcar como leído: ${n.title}`}
                  title="Marcar como leído"
                  onClick={() => markRead([n.id])}
                  className="size-8 shrink-0 border-transparent text-muted-foreground"
                >
                  <Check strokeWidth={2} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-divider px-4 py-2.5">
          <PopoverClose asChild>
            <Link
              to={`${PRODUCTS_PATH}?alarma=1`}
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              Ver el stock en el catálogo
            </Link>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
