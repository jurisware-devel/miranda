import { useEffect, useState } from "react";
import { client } from "../amplifyClient";
import type { CaseItem } from "../types";

export const useCasesData = (enabled = true) => {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    async function loadCases() {
      try {
        const { data, errors } = await client.models.Case.list({ limit: 5000 });
        if (errors?.length) {
          throw new Error(
            errors
              .map((err) => ("message" in err && err.message ? err.message : String(err)))
              .join("; "),
          );
        }
        if (!active) return;
        setCases((data ?? []) as CaseItem[]);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load cases");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadCases();
    return () => {
      active = false;
    };
  }, [enabled]);

  return { cases, setCases, loading, error };
};
