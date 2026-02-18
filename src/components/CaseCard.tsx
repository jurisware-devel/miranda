import React from "react";
import { Card } from "antd";
import ReactMarkdown from "react-markdown";
import TagCapsule from "./TagCapsule";
import type { CaseItem } from "../logic/types";
import type { TagMeta } from "../logic/tagUtils";
import { formatCaseCitationLine, getCourtBadgeLabel, getCourtCode } from "../logic/caseUtils";
import { getReadableTextColor } from "../logic/colorUtils";

type CaseCardProps = {
  caseItem: CaseItem;
  index: number;
  tagIds: string[];
  tagsById: Map<string, TagMeta>;
  onOpenCase: (caseId: string) => void;
};

const CaseCard: React.FC<CaseCardProps> = ({
  caseItem,
  index,
  tagIds,
  tagsById,
  onOpenCase,
}) => {
  const title = caseItem.caseName ?? `Case ${index + 1}`;
  const citeLine = formatCaseCitationLine(caseItem) || "—";
  const summary = caseItem.summary ?? "";
  const hasSummary = summary.trim().length > 0;

  return (
    <Card key={caseItem.caseId ?? index} className="grid-card" size="small">
      <div className="grid-card__badge">
        <span className={`badge badge--court badge--court-${getCourtCode(caseItem.court)}`}>{getCourtBadgeLabel(caseItem.court)}</span>
      </div>
      <div className="grid-card__title">
        <button
          type="button"
          className="grid-card__link"
          onClick={() => onOpenCase(caseItem.caseId)}
        >
          {title}
        </button>
      </div>
      <div className="grid-card__meta">{citeLine}</div>
      <div className="grid-card__author">{caseItem.authoringJudge || "Memorandum"}</div>
      <div className="grid-card__tags">
        {tagIds.length
          ? tagIds.map((tagId) => (
              <TagCapsule
                key={tagId}
                label={tagsById.get(tagId)?.label ?? "Untitled"}
                background={tagsById.get(tagId)?.color ?? undefined}
                color={getReadableTextColor(tagsById.get(tagId)?.color)}
              />
            ))
          : null}
      </div>
      <div className="grid-card__summary">
        {hasSummary ? (
          <ReactMarkdown className="grid-card__summary-markdown">{summary}</ReactMarkdown>
        ) : (
          "—"
        )}
      </div>
    </Card>
  );
};

export default CaseCard;
