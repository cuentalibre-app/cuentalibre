import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapPin, Signpost } from "lucide-react";
import { Input } from "@cuentalibre/ui/components/input";
import { Popover, PopoverAnchor, PopoverContent } from "@cuentalibre/ui/components/popover";
import { cn } from "@cuentalibre/ui/lib/cn";
import type { FieldControlProps } from "@/features/sales/form-fields";
import {
  MIN_QUERY,
  candidatesUrl,
  pickedAddress,
  toSuggestions,
  type AddressSuggestion,
  type Candidate,
} from "./address-search-model";

/** Waits for a pause in typing, so a search isn't sent for every key. */
const DEBOUNCE_MS = 250;

/**
 * The geocoder now and then leaves a request hanging, and the browser queues
 * the same URL behind it: give up so the next key searches again.
 */
const TIMEOUT_MS = 4000;

/** Answers already fetched, by URL: going back over a word doesn't ask again. */
const cache = new Map<string, AddressSuggestion[]>();

async function search(query: string, postalCode: string, signal: AbortSignal) {
  const urls = [candidatesUrl(query, postalCode)];
  // A wrong or stale postal code shouldn't hide the street: retry without it
  if (urls[0] !== candidatesUrl(query)) urls.push(candidatesUrl(query));
  let failure: unknown = null;
  for (const url of urls) {
    let hit = cache.get(url);
    if (!hit) {
      try {
        const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        hit = toSuggestions((await response.json()) as Candidate[]);
        cache.set(url, hit);
      } catch (error) {
        if (signal.aborted) throw error;
        failure = error;
        continue;
      }
    }
    if (hit.length) return hit;
  }
  if (failure) throw failure;
  return [];
}

/**
 * The street field of a Spanish address, suggesting streets and street numbers
 * from CartoCiudad as the user types. Picking one fills the postal code, town
 * and province too. Without a connection it's a plain text field.
 */
export function AddressSearchInput({
  value,
  postalCode,
  onChange,
  onPick,
  ...field
}: FieldControlProps & {
  value: string;
  /** Narrows the search when it's already filled in. */
  postalCode: string;
  onChange: (address: string) => void;
  onPick: (suggestion: AddressSuggestion) => void;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  // Only what the user types is searched, not what a pick or a saved contact puts in the field
  const [query, setQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (query == null || query.trim().length < MIN_QUERY) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      search(query, postalCode, controller.signal).then(
        (found) => {
          setSuggestions(found);
          setActive(-1);
          setOpen(found.length > 0 && document.activeElement === input.current);
        },
        // Offline or the service is down: the field keeps working as plain text
        () => !controller.signal.aborted && setOpen(false),
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // The postal code only narrows a search the typing starts
  }, [query]);

  const pick = (s: AddressSuggestion) => {
    onPick({ ...s, address: pickedAddress(s, value) });
    setOpen(false);
    setSuggestions([]);
    if (s.street) {
      // A whole street: the user goes on with the number, which searches again
      const withSpace = `${s.address} `;
      onChange(withSpace);
      setQuery(null);
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.setSelectionRange(withSpace.length, withSpace.length);
      });
    } else {
      setQuery(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) {
      if (e.key === "ArrowDown" && suggestions.length) {
        e.preventDefault();
        setOpen(true);
        setActive(0);
      }
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const last = suggestions.length - 1;
      setActive((i) => (e.key === "ArrowDown" ? (i >= last ? 0 : i + 1) : i <= 0 ? last : i - 1));
    } else if (e.key === "Enter" && active >= 0 && suggestions[active]) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const activeId = active >= 0 && active < suggestions.length ? `${listId}-${active}` : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          {...field}
          ref={input}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? activeId : undefined}
          value={value}
          autoComplete="street-address"
          onChange={(e) => {
            onChange(e.target.value);
            setQuery(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        // The field keeps the focus: the list is only pointed at and clicked
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.target === input.current && e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        className="w-(--radix-popover-trigger-width) min-w-72 overflow-hidden p-1.5"
      >
        <ul id={listId} role="listbox" aria-label="Direcciones sugeridas" className="m-0 flex list-none flex-col p-0">
          {suggestions.map((s, i) => {
            const Icon = s.street ? Signpost : MapPin;
            const place = [[s.postalCode, s.city].filter(Boolean).join(" "), s.province].filter(Boolean).join(", ");
            return (
              <li
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(s)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition-colors duration-150 select-none",
                  i === active && "bg-muted",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium text-pretty">{s.address}</span>
                  {place && <span className="text-sm text-muted-foreground">{place}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
