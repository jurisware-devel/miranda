import React from "react";
import { Card } from "antd";
import ReviewField from "./ReviewField";
import type { CaseItem } from "../logic/types";

type CaseCardProps = {
  caseItem: CaseItem;
  index: number;
  tagIds: string[];
  tagsById: Map<string, string>;
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
  const cite = caseItem.ny3dCite || caseItem.slipOp || caseItem.citation || "—";
  const decision = caseItem.decisionDate
    ? new Date(caseItem.decisionDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const citeLine = `${cite} (${decision})`;
  const handleReviewClick = () => onOpenCase(caseItem.caseId);

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
              <span key={tagId} className="tag-pill">
                {tagsById.get(tagId) ?? "Untitled"}
              </span>
            ))
          : null}
      </div>
      <div className="grid-card__summary">
        {(caseItem.summary ?? "").trim() && (caseItem.ai_review ?? true) ? (
          <div className="grid-card__ai-flag">AI gen - needs review</div>
        ) : null}
        <ReviewField
          value={caseItem.summary ?? undefined}
          fallback="—"
          onReviewClick={handleReviewClick}
        />
      </div>
    </Card>
  );
};

export default CaseCard;
