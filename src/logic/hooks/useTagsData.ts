import { useEffect, useState } from "react";
import { client } from "../amplifyClient";
import type { CaseTagItem, TagItem } from "../types";

export const useTagsData = (enabled = true) => {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [caseTags, setCaseTags] = useState<CaseTagItem[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [caseTagsError, setCaseTagsError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    async function loadTagsAndLinks() {
      try {
        const [{ data: tagData }, { data: linkData }] = await Promise.all([
          client.models.Tag.list({ limit: 5000 }),
          client.models.CaseTag.list({ limit: 5000 }),
        ]);
        if (!active) return;
        setTags(tagData ?? []);
        setCaseTags(linkData ?? []);
        setTagsError(null);
        setCaseTagsError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load tags";
        setTagsError(message);
        setCaseTagsError(message);
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
    tagsError,
    caseTagsError,
  };
};
