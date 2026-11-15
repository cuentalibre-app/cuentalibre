/** A path segment that names one record rather than a page: an id or a number. */
const isRecord = (segment: string) => /\d/.test(segment) || /^[0-9a-f-]{20,}$/.test(segment);

/**
 * The screen a URL shows, as the guide's screen list (pantallas.md) writes its address: a
 * record's id becomes ":id" and a period "trimestre" or "año", so the address is the same for
 * every record and every year, and carries none of the person's data. Other queries go.
 */
export function screenPath(pathname: string, search: string): string {
  const path = pathname
    .split("/")
    .map((segment) => (isRecord(segment) ? ":id" : segment))
    .join("/");
  const period = new URLSearchParams(search).get("periodo");
  return period ? `${path}?periodo=${/T\d$/.test(period) ? "trimestre" : "año"}` : path;
}
