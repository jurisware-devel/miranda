import React from "react";
import type { CaseItem, CourtItem } from "../../../core/types";
import {
  formatCaseCitationLine,
  formatOpinionSubtitle,
  getCourtLongLabel,
} from "../../../core/utils/caseUtils";
import type { OpinionDocument } from "../../../core/opinions/types";

type OpinionPdfViewProps = {
  caseItem: CaseItem;
  courtsById: Map<string, CourtItem>;
  opinionPdfUrl: string;
  opinionDocument?: OpinionDocument | null;
};

const OpinionPdfView: React.FC<OpinionPdfViewProps> = ({
  caseItem,
  courtsById,
  opinionPdfUrl,
  opinionDocument,
}) => {
  const pdfPublishedSubtitle = formatOpinionSubtitle({
    publicationStatus: opinionDocument?.source?.publicationStatus,
    officialCitation: opinionDocument?.header?.officialCitation ?? caseItem.ny3dCite ?? caseItem.citation,
    slipOpinion: opinionDocument?.header?.slipOpinion ?? caseItem.slipOp,
    decisionDate: opinionDocument?.header?.decisionDate ?? caseItem.decisionDate,
  });

  return (
    <div className="case-detail__pdf-viewer">
      <div className="case-detail__pdf-header">
        <h1 className="case-detail__pdf-title">{caseItem.caseName?.trim() || "Untitled Case"}</h1>
        {pdfPublishedSubtitle ? (
          <p className="case-detail__pdf-subtitle">{pdfPublishedSubtitle}</p>
        ) : null}
        <p className="case-detail__pdf-meta">{formatCaseCitationLine(caseItem)}</p>
        <p className="case-detail__pdf-court">{getCourtLongLabel(caseItem.court, courtsById)}</p>
      </div>
      <div className="case-detail__pdf-actions">
        <a className="case-detail__pdf-link" href={opinionPdfUrl} target="_blank" rel="noreferrer">
          View PDF
        </a>
      </div>
      <div className="case-detail__pdf-frame-wrap">
        <iframe title="Opinion PDF" src={opinionPdfUrl} className="case-detail__pdf-frame" />
      </div>
    </div>
  );
};

export default OpinionPdfView;
