import React from "react";
import type { OpinionDocument } from "../../core/opinions/types";

type OpinionHeaderProps = {
  document: OpinionDocument;
  fallbackTitle?: string | null;
  fallbackSlipOpinion?: string | null;
  fallbackOfficialCitation?: string | null;
  fallbackCourt?: string | null;
  fallbackDecisionDate?: string | null;
};

const OpinionHeader: React.FC<OpinionHeaderProps> = ({
  document,
  fallbackTitle,
  fallbackSlipOpinion,
  fallbackOfficialCitation,
  fallbackCourt,
  fallbackDecisionDate,
}) => {
  const header = document.header;
  const title = header?.title ?? fallbackTitle ?? "";
  const slipOpinion = header?.slipOpinion ?? fallbackSlipOpinion ?? "";
  const officialCitation = header?.officialCitation ?? fallbackOfficialCitation ?? "";
  const court = header?.court ?? fallbackCourt ?? "";
  const decisionDate = header?.decisionDate ?? fallbackDecisionDate ?? "";

  if (!title && !slipOpinion && !officialCitation && !court && !decisionDate) return null;

  return (
    <header className="opinion-header">
      {title ? <h1 className="case-detail__pdf-title">{title}</h1> : null}
      {slipOpinion || officialCitation ? (
        <p className="case-detail__pdf-meta">
          {[slipOpinion, officialCitation].filter(Boolean).join(" • ")}
        </p>
      ) : null}
      {court || decisionDate ? (
        <p className="case-detail__pdf-court">
          {[court, decisionDate].filter(Boolean).join(" • ")}
        </p>
      ) : null}
    </header>
  );
};

export default OpinionHeader;
