import { useEffect, useMemo, useState } from "react";
import { Alert, Card, Masonry, Spin } from "antd";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { useNavigate } from "react-router-dom";
import { darkenHex, getReadableTextColor } from "../core/utils/colorUtils";
import TagCapsule from "../components/public/TagCapsule";

const client = generateClient<Schema>();

type TagRow = Schema["Tag"]["type"];
const TAG_PALETTE = [
  { bg: "#E0F2FE", text: "#0C4A6E" },
  { bg: "#DCFCE7", text: "#166534" },
  { bg: "#FFE4E6", text: "#9F1239" },
  { bg: "#FEF3C7", text: "#92400E" },
  { bg: "#EDE9FE", text: "#5B21B6" },
  { bg: "#ECFEFF", text: "#155E75" },
  { bg: "#FEE2E2", text: "#991B1B" },
  { bg: "#E2E8F0", text: "#1E293B" },
  { bg: "#FCE7F3", text: "#9D174D" },
  { bg: "#D1FAE5", text: "#065F46" },
  { bg: "#FDE68A", text: "#78350F" },
  { bg: "#DBEAFE", text: "#1D4ED8" },
];

const sortTags = (values: TagRow[]) =>
  [...values].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
  );

export default function TagsPage() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseTags, setCaseTags] = useState<Schema["CaseTag"]["type"][]>([]);

  useEffect(() => {
    let active = true;
    async function loadTags() {
      try {
        setLoading(true);
        const [
          { data: tagData, errors: tagErrors },
          { data: caseTagData, errors: caseTagErrors },
        ] = await Promise.all([
          client.models.Tag.list({ limit: 5000, authMode: "iam" }),
          client.models.CaseTag.list({ limit: 5000, authMode: "iam" }),
        ]);
        const allErrors = [...(tagErrors ?? []), ...(caseTagErrors ?? [])];
        if (allErrors.length) {
          throw new Error(
            allErrors
              .map((err) => ("message" in err && err.message ? err.message : String(err)))
              .join("; "),
          );
        }
        if (!active) return;
        setTags(tagData ?? []);
        setCaseTags(caseTagData ?? []);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load tags");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTags();
    return () => {
      active = false;
    };
  }, []);

  const sortedTags = useMemo(() => sortTags(tags), [tags]);

  const tagChildren = useMemo(() => {
    const map = new Map<string | null, TagRow[]>();
    for (const tag of sortedTags) {
      const key = tag.parentTagId ?? null;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(tag);
    }
    return map;
  }, [sortedTags]);

  const tagCaseCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of caseTags) {
      map.set(item.tagId, (map.get(item.tagId) ?? 0) + 1);
    }
    return map;
  }, [caseTags]);

  const formatTagLabel = (tag: TagRow) => {
    const count = tagCaseCounts.get(tag.tagId) ?? 0;
    if (count <= 0) return tag.label ?? "Untitled";
    return `${tag.label ?? "Untitled"} (${count})`;
  };

  const rootTags = useMemo(() => {
    const ids = new Set(sortedTags.map((tag) => tag.tagId));
    return sortedTags.filter((tag) => !tag.parentTagId || !ids.has(tag.parentTagId));
  }, [sortedTags]);

  const tagColorMap = useMemo(() => {
    const map = new Map<string, { bg: string; text: string }>();
    rootTags.forEach((tag, index) => {
      const color = TAG_PALETTE[index % TAG_PALETTE.length];
      const bg = tag.color ?? color.bg;
      map.set(tag.tagId, { bg, text: color.text });
    });
    return map;
  }, [rootTags]);

  const masonryItems = useMemo(
    () => rootTags.map((tag) => ({ key: tag.tagId, data: { tag } })),
    [rootTags],
  );

  return (
    <div className="tags-page">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {loading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : (
        <div className="tags-masonry-wrap">
          <Masonry
            columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
            gutter={{ xs: 12, sm: 12, md: 16 }}
            items={masonryItems}
            itemRender={({ data }) => {
              if (!data.tag) return null;
              const tag = data.tag;
              const children = tagChildren.get(tag.tagId) ?? [];
              const hasChildren = children.length > 0;
              const color = tagColorMap.get(tag.tagId) ?? { bg: "#E2E8F0", text: "#1E293B" };
              const parentBg = darkenHex(color.bg, 0.08);
              const parentText = getReadableTextColor(parentBg, color.text);
              const childText = getReadableTextColor(color.bg, color.text);

              return (
                <div className="tags-masonry-item">
                  <Card
                    className={`tag-card tag-card--parent${
                      hasChildren ? "" : " tag-card--parent-empty"
                    }`}
                    size="small"
                  >
                    <TagCapsule
                      size="lg"
                      label={formatTagLabel(tag)}
                      background={parentBg}
                      color={parentText}
                      onClick={() => navigate("/pub", { state: { tagId: tag.tagId } })}
                      className="tag-card__title"
                      ariaLabel={`Filter by ${tag.label ?? "tag"}`}
                    />
                    {hasChildren ? (
                      <div className="tag-card__children">
                        {children.map((child) => (
                          <TagCapsule
                            key={child.tagId}
                            label={formatTagLabel(child)}
                            background={color.bg}
                            color={childText}
                            onClick={() => navigate("/pub", { state: { tagId: child.tagId } })}
                            className="tag-card__child"
                            ariaLabel={`Filter by ${child.label ?? "tag"}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </Card>
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
