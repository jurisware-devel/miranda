import { useEffect, useState } from "react";
import { client } from "../amplifyClient";
import type { CourtItem } from "../types";

type UseCourtsDataOptions = {
  enabled?: boolean;
  authMode: "iam" | "userPool";
};

export const useCourtsData = ({ enabled = true, authMode }: UseCourtsDataOptions) => {
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;
    async function loadCourts() {
      try {
        setLoading(true);
        const { data, errors } = await client.models.Court.list({
          limit: 100,
          authMode,
        });
        if (errors?.length) {
          throw new Error(
            errors
              .map((err) => ("message" in err && err.message ? err.message : String(err)))
              .join("; "),
          );
        }
        if (!active) return;
        setCourts((data ?? []) as CourtItem[]);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load courts");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCourts();
    return () => {
      active = false;
    };
  }, [authMode, enabled]);

  return { courts, loading, error };
};
