import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CaseItem, CourtItem } from "../../../core/types";
import { formatOpinionSubtitle, getCourtLongLabel } from "../../../core/utils/caseUtils";
import type { OpinionDocument } from "../../../core/opinions/types";
import OpinionAppearances from "./OpinionAppearances";
import OpinionHeader from "./OpinionHeader";

type OpinionPdfViewProps = {
  caseItem: CaseItem;
  courtsById: Map<string, CourtItem>;
  opinionPdfUrl: string;
  opinionDocument?: OpinionDocument | null;
};

export const shouldUseExternalPdfViewer = (nav?: {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}): boolean => {
  if (!nav) return false;

  const userAgent = nav.userAgent ?? "";
  const platform = nav.platform ?? "";
  const maxTouchPoints = nav.maxTouchPoints ?? 0;
  const isIOSDevice = /iPad|iPhone|iPod/i.test(userAgent) || /iPad|iPhone|iPod/i.test(platform);
  const isIPadDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;

  return isIOSDevice || isIPadDesktopMode;
};

const OpinionPdfView: React.FC<OpinionPdfViewProps> = ({
  caseItem,
  courtsById,
  opinionPdfUrl,
  opinionDocument,
}) => {
  const [showHeader, setShowHeader] = useState(false);
  const [preferExternalPdfView, setPreferExternalPdfView] = useState(false);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const pdfPublishedSubtitle = formatOpinionSubtitle({
    publicationStatus: opinionDocument?.source?.publicationStatus,
    officialCitation: opinionDocument?.header?.officialCitation ?? caseItem.ny3dCite ?? caseItem.citation,
    slipOpinion: opinionDocument?.header?.slipOpinion ?? caseItem.slipOp,
    decisionDate: opinionDocument?.header?.decisionDate ?? caseItem.decisionDate,
  });
  const bodyLabelId = useMemo(
    () => `opinion-pdf-body-${opinionDocument?.source?.caseId ?? caseItem.caseId ?? "document"}`,
    [caseItem.caseId, opinionDocument?.source?.caseId],
  );
  const appearances = opinionDocument?.header?.appearances ?? opinionDocument?.appearances ?? [];
  const hasAppearances = Boolean(appearances.some((appearance) => appearance?.text?.trim()));
  const fallbackCourt = getCourtLongLabel(caseItem.court, courtsById);
  const title = opinionDocument?.header?.title ?? caseItem.caseName?.trim() ?? "Untitled Case";

  useEffect(() => {
    setShowHeader(false);
  }, [caseItem.caseId, opinionDocument?.source?.caseId]);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      setPreferExternalPdfView(false);
      return;
    }

    setPreferExternalPdfView(shouldUseExternalPdfViewer(navigator));
  }, []);

  const handleHeaderToggle = () => {
    setShowHeader((value) => !value);
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div className="case-detail__opinion-content opinion-document case-detail__pdf-viewer">
      <section className="opinion-document__title-shell" aria-labelledby="opinion-title-heading">
        <div className="opinion-document__title-bar">
          <div className="opinion-title-section">
            {title ? <h1 id="opinion-title-heading" className="case-detail__pdf-title">{title}</h1> : null}
          </div>
          <div className="opinion-document__title-actions">
            <button
              type="button"
              className="opinion-document__toggle"
              onClick={handleHeaderToggle}
            >
              {showHeader ? "Hide" : "Header"}
            </button>
          </div>
        </div>
        {pdfPublishedSubtitle ? (
          <div className="opinion-document__subtitle-row">
            <div className="opinion-document__subtitle-content">
              <p className="case-detail__pdf-subtitle">{pdfPublishedSubtitle}</p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="opinion-document__main">
        <section className="opinion-document__body-shell" aria-labelledby={bodyLabelId}>
          <h2 id={bodyLabelId} className="sr-only">
            PDF
          </h2>
          <div ref={bodyScrollRef} className="opinion-document__body-scroll">
            {showHeader && opinionDocument ? (
              <div className="opinion-document__header-body opinion-document__header-body--inline" aria-label="Header">
                <OpinionHeader
                  document={opinionDocument}
                  variant="details"
                  fallbackTitle={caseItem.caseName}
                  fallbackSlipOpinion={caseItem.slipOp}
                  fallbackOfficialCitation={caseItem.ny3dCite ?? caseItem.citation}
                  fallbackCourt={fallbackCourt}
                  fallbackDecisionDate={caseItem.decisionDate}
                />
                {hasAppearances ? (
                  <OpinionAppearances appearances={appearances} />
                ) : null}
              </div>
            ) : null}
            <div
              className={
                preferExternalPdfView
                  ? "case-detail__pdf-actions case-detail__pdf-actions--visible"
                  : "case-detail__pdf-actions"
              }
            >
              <a className="case-detail__pdf-link" href={opinionPdfUrl} target="_blank" rel="noreferrer">
                {preferExternalPdfView ? "Open PDF in browser" : "View PDF"}
              </a>
            </div>
            {preferExternalPdfView ? (
              <p className="case-detail__pdf-fallback-note">
                iPhone and iPad browsers open this opinion in the native PDF viewer for reliable paging.
              </p>
            ) : (
              <div className="case-detail__pdf-frame-wrap">
                <iframe title="Opinion PDF" src={opinionPdfUrl} className="case-detail__pdf-frame" />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OpinionPdfView;
