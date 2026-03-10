import React from "react";
import { Card } from "antd";
import ReactMarkdown from "react-markdown";
import AdminTagCapsule from "./AdminTagCapsule";
import type { CaseItem, PhaseItem } from "../core/types";
import { getPhaseLabel } from "../core/utils/phaseUtils";
import type { TagMeta } from "../core/utils/tagUtils";
import { formatCaseCitationLine, getCourtBadgeLabel, getCourtCode } from "../core/utils/caseUtils";
import { getReadableTextColor } from "../core/utils/colorUtils";

type AdminCaseCardProps = {
  caseItem: CaseItem;
  index: number;
  phases: PhaseItem[];
  tagIds: string[];
  tagsById: Map<string, TagMeta>;
  onOpenCase: (caseId: string) => void;
};

const AdminCaseCard: React.FC<AdminCaseCardProps> = ({
  caseItem,
  index,
  phases,
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
      {phases.length ? (
        <div
          className="grid-card__phases"
          style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
        >
          {phases.map((phase) => (
            <span key={phase} className="grid-card__phase-capsule">
              {getPhaseLabel(phase)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid-card__tags">
        {tagIds.length
          ? tagIds.map((tagId) => (
              <AdminTagCapsule
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

export default AdminCaseCard;
