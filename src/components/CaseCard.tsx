import React from "react";
import { Card } from "antd";
import ReactMarkdown from "react-markdown";
import ReviewField from "./ReviewField";
import TagCapsule from "./TagCapsule";
import type { CaseItem } from "../logic/types";
import type { TagMeta } from "../logic/tagUtils";
import { formatCaseCitationLine, REVIEW_MARKER } from "../logic/caseUtils";
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
  const handleReviewClick = () => onOpenCase(caseItem.caseId);
  const summary = caseItem.summary ?? "";
  const hasSummary = summary.trim().length > 0;
  const needsReview = summary.includes(REVIEW_MARKER);


  return (
    <Card key={caseItem.caseId ?? index} className="grid-card" size="small">
      <div className="grid-card__badge">
        <span className="badge badge--coa">CoA</span>
      </div>
      <div className="grid-card__title">
        <button
          type="button"
          className="grid-card__link"
          onClick={() => onOpenCase(caseItem.caseId)}
        >
          <ReviewField
            value={title}
            fallback={`Case ${index + 1}`}
            onReviewClick={handleReviewClick}
          />
        </button>
      </div>
      <div className="grid-card__meta">
        <ReviewField value={citeLine} fallback="—" onReviewClick={handleReviewClick} />
      </div>
      <div className="grid-card__author">
        <ReviewField
          value={caseItem.authoringJudge || "Memorandum"}
          fallback="Memorandum"
          onReviewClick={handleReviewClick}
        />
      </div>
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
          needsReview ? (
            <ReviewField
              value={summary}
              fallback="—"
              onReviewClick={handleReviewClick}
            />
          ) : (
            <ReactMarkdown className="grid-card__summary-markdown">
              {summary}
            </ReactMarkdown>
          )
        ) : (
          <ReviewField fallback="—" onReviewClick={handleReviewClick} />
        )}
      </div>
    </Card>
  );
};

export default CaseCard;
