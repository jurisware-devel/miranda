import React from "react";
import type { OpinionDocument } from "../../core/opinions/types";

type OpinionHeaderProps = {
  document: OpinionDocument;
};

const OpinionHeader: React.FC<OpinionHeaderProps> = ({ document }) => {
  const header = document.header;
  if (!header) return null;

  return (
    <header className="opinion-header">
      {header.title ? <h1 className="case-detail__pdf-title">{header.title}</h1> : null}
      {header.slipOpinion || header.officialCitation ? (
        <p className="case-detail__pdf-meta">
          {[header.slipOpinion, header.officialCitation].filter(Boolean).join(" • ")}
        </p>
      ) : null}
      {header.court || header.decisionDate ? (
        <p className="case-detail__pdf-court">
          {[header.court, header.decisionDate].filter(Boolean).join(" • ")}
        </p>
      ) : null}
    </header>
  );
};

export default OpinionHeader;
