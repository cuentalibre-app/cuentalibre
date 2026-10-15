import { useSearchParams } from "react-router";
import { defaultPeriod, parsePeriod, periodKey, type Period } from "@fiscalia/core";

const PARAM = "periodo";

/** The selected period, kept in the URL (?periodo=2026-T3) so it survives reloads and can be shared. */
export function usePeriod(today: Date): [Period, (period: Period) => void] {
  const [params, setParams] = useSearchParams();
  const period = parsePeriod(params.get(PARAM) ?? "") ?? defaultPeriod(today);

  const setPeriod = (next: Period) => {
    setParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.set(PARAM, periodKey(next));
        return updated;
      },
      { replace: true },
    );
  };

  return [period, setPeriod];
}
