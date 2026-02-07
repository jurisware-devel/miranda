import type { CaseTagItem, TagItem } from "./types";

export const mapTagsById = (tags: TagItem[]) =>
  new Map(tags.map((tag) => [tag.tagId, tag.label ?? ""]));

export const buildSortedTags = (tags: TagItem[]) =>
  [...tags].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
  );

export const buildTagOptions = (tags: TagItem[]) => {
  type TagOption = { value: string; label: string };
  const sortedTags = buildSortedTags(tags);
  const children = new Map<string | null, TagItem[]>();
  for (const tag of sortedTags) {
    const key = tag.parentTagId ?? null;
    if (!children.has(key)) {
      children.set(key, []);
    }
    children.get(key)?.push(tag);
  }
  const makeOptions = (parentId: string | null, depth: number): TagOption[] => {
    const nodes = children.get(parentId) ?? [];
    return nodes.flatMap((node) => {
      const labelPrefix = depth ? `${"—".repeat(depth)} ` : "";
      const option: TagOption = {
        value: node.tagId,
        label: `${labelPrefix}${node.label ?? "Untitled"}`,
      };
      return [option, ...makeOptions(node.tagId, depth + 1)];
    });
  };
  return makeOptions(null, 0);
};

export const mapCaseTagsByCaseId = (
  caseTags: CaseTagItem[],
  tagsById: Map<string, string>,
) => {
  const map = new Map<string, string[]>();
  for (const item of caseTags) {
    if (!map.has(item.caseId)) {
      map.set(item.caseId, []);
    }
    map.get(item.caseId)?.push(item.tagId);
  }
  for (const [caseId, tagIds] of map.entries()) {
    const sorted = [...tagIds].sort((a, b) =>
      (tagsById.get(a) ?? "").localeCompare(tagsById.get(b) ?? "", undefined, {
        sensitivity: "base",
      }),
    );
    map.set(caseId, sorted);
  }
  return map;
};
