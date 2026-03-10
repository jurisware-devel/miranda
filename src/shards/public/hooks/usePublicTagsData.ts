import { useEffect, useState } from "react";
import { client } from "../../../core/amplifyClient";
import type { CasePhaseItem, CaseTagItem, TagItem } from "../../../core/types";

export const usePublicTagsData = (enabled = true) => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [caseTags, setCaseTags] = useState<CaseTagItem[]>([]);
  const [casePhases, setCasePhases] = useState<CasePhaseItem[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [caseTagsError, setCaseTagsError] = useState<string | null>(null);
  const [casePhasesError, setCasePhasesError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    async function loadTagsAndLinks() {
      try {
        const [
          { data: tagData, errors: tagErrors },
          { data: linkData, errors: linkErrors },
          { data: phaseLinkData, errors: phaseLinkErrors },
        ] =
          await Promise.all([
            client.models.Tag.list({ limit: 5000, authMode: "iam" }),
            client.models.CaseTag.list({ limit: 5000, authMode: "iam" }),
            client.models.CasePhase.list({ limit: 5000, authMode: "iam" }),
          ]);
        const allErrors = [...(tagErrors ?? []), ...(linkErrors ?? []), ...(phaseLinkErrors ?? [])];
        if (allErrors.length) {
          throw new Error(
            allErrors
              .map((err) => ("message" in err && err.message ? err.message : String(err)))
              .join("; "),
          );
        }
        if (!active) return;
        setTags(tagData ?? []);
        setCaseTags(linkData ?? []);
        setCasePhases(phaseLinkData ?? []);
        setTagsError(null);
        setCaseTagsError(null);
        setCasePhasesError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load tags";
        setTagsError(message);
        setCaseTagsError(message);
        setCasePhasesError(message);
      }
    }

    void loadTagsAndLinks();
    return () => {
      active = false;
    };
  }, [enabled]);

  return {
    tags,
    setTags,
    caseTags,
    setCaseTags,
    casePhases,
    setCasePhases,
    tagsError,
    caseTagsError,
    casePhasesError,
  };
};
