import React, { useEffect, useRef, useState } from "react";
import { Alert, Spin } from "antd";
import ReactMarkdown from "react-markdown";
import { useParams } from "react-router-dom";
import { client } from "../../core/amplifyClient";
import { loadOpinionDocument } from "../../core/opinions/loadOpinionDocument";
import type { OpinionDocument } from "../../core/opinions/types";
import type { CaseItem, CourtItem } from "../../core/types";
import { formatCaseCitationLine, getCourtLongLabel } from "../../core/utils/caseUtils";
import { preserveNumericReferencePrefixes } from "../../core/utils/opinionMarkdown";
import OpinionDocumentView from "../../components/shared/opinion/OpinionDocumentView";

type OpinionCaseDetailLayerProps = {
  cases: CaseItem[];
  courtsById: Map<string, CourtItem>;
  loading: boolean;
  error: string | null;
};

const OpinionCaseDetailLayer: React.FC<OpinionCaseDetailLayerProps> = ({
  cases,
  courtsById,
  loading,
  error,
}) => {
  const { caseId } = useParams();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [opinionDocument, setOpinionDocument] = useState<OpinionDocument | null>(null);
  const [opinionMarkdown, setOpinionMarkdown] = useState("");
  const [opinionSourceUrl, setOpinionSourceUrl] = useState<string>("");
  const [opinionPdfUrl, setOpinionPdfUrl] = useState<string>("");
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);
  const renderedOpinionMarkdown = preserveNumericReferencePrefixes(opinionMarkdown);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "auto" });
    const contentContainer = panelRef.current?.closest(".app-content");
    if (contentContainer instanceof HTMLElement) {
      contentContainer.scrollTo({ top: 0, behavior: "auto" });
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [caseId]);

  useEffect(() => {
    let active = true;
    if (!caseId) return;
    const caseIdValue = caseId;

    const existing = cases.find((item) => item.caseId === caseIdValue) ?? null;
    setCaseItem(existing);
    if (existing || loading) {
      setCaseError(null);
      return;
    }

    async function loadCase() {
      try {
        setCaseLoading(true);
        const result = await client.models.Case.get({ caseId: caseIdValue }, { authMode: "iam" });
        if (!active) return;
        setCaseItem((result?.data ?? null) as CaseItem | null);
        setCaseError(null);
      } catch (err) {
        if (!active) return;
        setCaseError(err instanceof Error ? err.message : "Failed to load case");
      } finally {
        if (active) setCaseLoading(false);
      }
    }

    void loadCase();
    return () => {
      active = false;
    };
  }, [caseId, cases, loading]);

  useEffect(() => {
    let active = true;
    if (!caseItem?.caseId) {
      setOpinionDocument(null);
      setOpinionMarkdown("");
      setOpinionSourceUrl("");
      setOpinionPdfUrl("");
      return;
    }
    const currentCase = caseItem;

    async function loadOpinion() {
      try {
        setOpinionLoading(true);
        setOpinionError(null);
        setOpinionDocument(null);
        setOpinionMarkdown("");
        setOpinionSourceUrl("");
        setOpinionPdfUrl("");

        const result = await loadOpinionDocument(currentCase.caseId, currentCase);
        if (!active) return;

        if (result.kind === "pdf") {
          setOpinionPdfUrl(result.pdfUrl);
          return;
        }

        if (result.kind === "markdown") {
          setOpinionMarkdown(result.markdown);
          setOpinionSourceUrl(result.sourceUrl);
          return;
        }

        setOpinionDocument(result.document);
        setOpinionSourceUrl(result.sourceUrl);
      } catch (err) {
        if (!active) return;
        setOpinionError(err instanceof Error ? err.message : "Failed to load opinion document");
      } finally {
        if (active) setOpinionLoading(false);
      }
    }

    void loadOpinion();
    return () => {
      active = false;
    };
  }, [caseItem]);

  return (
    <div className="case-detail">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {caseError ? <Alert type="error" message={caseError} showIcon /> : null}
      {loading || caseLoading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : caseItem ? (
        <div ref={panelRef} className="case-detail__panel">
          {opinionError ? (
            <Alert type="error" message={opinionError} showIcon />
          ) : opinionLoading ? (
            <div className="card-grid__loading">
              <Spin />
            </div>
          ) : opinionDocument ? (
            <OpinionDocumentView
              document={opinionDocument}
              opinionSourceUrl={opinionSourceUrl}
              fallbackTitle={caseItem.caseName}
              fallbackSlipOpinion={caseItem.slipOp}
              fallbackOfficialCitation={caseItem.ny3dCite ?? caseItem.citation}
              fallbackCourt={getCourtLongLabel(caseItem.court, courtsById)}
              fallbackDecisionDate={caseItem.decisionDate}
            />
          ) : opinionMarkdown ? (
            <div className="case-detail__opinion-content">
              <ReactMarkdown>{renderedOpinionMarkdown}</ReactMarkdown>
            </div>
          ) : opinionPdfUrl ? (
            <div className="case-detail__pdf-viewer">
              <div className="case-detail__pdf-header">
                <h1 className="case-detail__pdf-title">{caseItem.caseName?.trim() || "Untitled Case"}</h1>
                <p className="case-detail__pdf-meta">{formatCaseCitationLine(caseItem)}</p>
                <p className="case-detail__pdf-court">
                  {getCourtLongLabel(caseItem.court, courtsById)}
                </p>
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
          ) : (
            <Alert type="info" message="Opinion content is not available yet." showIcon />
          )}
        </div>
      ) : (
        <Alert type="warning" message="Case not found" showIcon />
      )}
    </div>
  );
};

export default OpinionCaseDetailLayer;
