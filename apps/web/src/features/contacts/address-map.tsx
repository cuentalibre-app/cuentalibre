import { useState } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { Button } from "@cuentalibre/ui/components/button";
import {
  MAP_ZOOM,
  TILE_SIZE,
  addressKey,
  canLocate,
  placeUrl,
  searchUrls,
  tilesAround,
  type MapAddress,
  type Place,
} from "./address-map-model";

type Lookup =
  { key: string; status: "loading" | "notFound" | "error" } | { key: string; status: "found"; place: Place };

const link = "inline-flex items-center gap-1.5 font-medium text-primary no-underline hover:text-primary-hover";

/** A small map of the place: OpenStreetMap tiles with a pin in the middle, no map library. */
function PlaceMap({ place }: { place: Place }) {
  // Enough tiles to fill the widest form and the map's height around the center
  const tiles = tilesAround(place.lat, place.lon, MAP_ZOOM, 2, 1);
  return (
    <div className="relative h-44 animate-rise-in overflow-hidden rounded-lg border border-border bg-muted select-none">
      {tiles.map((tile) => (
        <img
          key={tile.url}
          src={tile.url}
          alt=""
          width={TILE_SIZE}
          height={TILE_SIZE}
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }}
        />
      ))}
      <MapPin
        aria-hidden="true"
        strokeWidth={1.75}
        className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-full fill-primary text-background"
      />
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-0 bottom-0 rounded-tl-md bg-background/85 px-1.5 py-0.5 text-2xs text-muted-foreground no-underline hover:text-foreground"
      >
        © OpenStreetMap
      </a>
    </div>
  );
}

/**
 * Looks the address up on OpenStreetMap when asked, and shows where it falls.
 * Nothing leaves the browser until the user presses the button; changing the
 * address hides the map until it's looked up again.
 */
export function AddressMap({ address }: { address: MapAddress }) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const key = addressKey(address);
  const current = lookup?.key === key ? lookup : null;

  const locate = async () => {
    setLookup({ key, status: "loading" });
    try {
      let hit: { lat: string; lon: string; display_name: string } | undefined;
      for (const url of searchUrls(address)) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        [hit] = (await response.json()) as (typeof hit & object)[];
        if (hit) break;
      }
      setLookup(
        hit
          ? { key, status: "found", place: { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name } }
          : { key, status: "notFound" },
      );
    } catch {
      setLookup({ key, status: "error" });
    }
  };

  if (current?.status === "found")
    return (
      <div className="flex flex-col gap-2">
        <PlaceMap place={current.place} />
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span className="min-w-0 text-muted-foreground">{current.place.label}</span>
          <a href={placeUrl(current.place)} target="_blank" rel="noopener noreferrer" className={link}>
            Abrir el mapa
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <Button
        variant="secondary"
        size="sm"
        disabled={!canLocate(address) || current?.status === "loading"}
        onClick={() => void locate()}
      >
        <MapPin aria-hidden="true" />
        {current?.status === "loading" ? "Buscando…" : "Ver en el mapa"}
      </Button>
      {current?.status === "notFound" && (
        <span role="status" className="text-sm text-muted-foreground">
          No encontramos esta dirección. Revisa la calle y el código postal.
        </span>
      )}
      {current?.status === "error" && (
        <span role="status" className="text-sm text-muted-foreground">
          No se ha podido consultar el mapa. Inténtalo de nuevo.
        </span>
      )}
    </div>
  );
}
