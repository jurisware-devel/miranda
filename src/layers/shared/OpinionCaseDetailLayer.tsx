import React, { useEffect, useRef, useState } from "react";
import { Alert, Spin, Tabs } from "antd";
import { useParams } from "react-router-dom";
import { client } from "../../core/amplifyClient";
import {
  loadOpinionJsonDocument,
  loadOpinionPdfUrl,
} from "../../core/opinions/loadOpinionDocument";
import type { OpinionDocument } from "../../core/opinions/types";
import type { CaseItem, CourtItem } from "../../core/types";
import { getCourtLongLabel } from "../../core/utils/caseUtils";
import OpinionDocumentView from "../../components/shared/opinion/OpinionDocumentView";
import OpinionPdfView from "../../components/shared/opinion/OpinionPdfView";

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
  const [opinionSourceUrl, setOpinionSourceUrl] = useState<string>("");
  const [opinionPdfUrl, setOpinionPdfUrl] = useState<string>("");
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);

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
        setOpinionSourceUrl("");
        setOpinionPdfUrl("");

        const [jsonResult, pdfResult] = await Promise.allSettled([
          loadOpinionJsonDocument(currentCase),
          loadOpinionPdfUrl(currentCase),
        ]);
        if (!active) return;

        if (jsonResult.status === "fulfilled") {
          setOpinionDocument(jsonResult.value.document);
          setOpinionSourceUrl(jsonResult.value.sourceUrl);
        }

        if (pdfResult.status === "fulfilled") {
          setOpinionPdfUrl(pdfResult.value);
        }

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
          ) : (
            <Tabs
              className="case-detail__opinion-tabs"
              defaultActiveKey="miranda"
              items={[
                {
                  key: "miranda",
                  label: "Miranda",
                  children: opinionDocument ? (
                    <div className="case-detail__opinion-tab-panel case-detail__opinion-tab-panel--miranda">
                      <OpinionDocumentView
                        document={opinionDocument}
                        opinionSourceUrl={opinionSourceUrl}
                        fallbackTitle={caseItem.caseName}
                        fallbackSlipOpinion={caseItem.slipOp}
                        fallbackOfficialCitation={caseItem.ny3dCite ?? caseItem.citation}
                        fallbackCourt={getCourtLongLabel(caseItem.court, courtsById)}
                        fallbackDecisionDate={caseItem.decisionDate}
                      />
                    </div>
                  ) : (
                    <Alert
                      type="info"
                      message="A Miranda-rendered opinion is not available for this case."
                      showIcon
                    />
                  ),
                },
                {
                  key: "pdf",
                  label: "PDF",
                  children: opinionPdfUrl ? (
                    <div className="case-detail__opinion-tab-panel">
                      <OpinionPdfView
                        caseItem={caseItem}
                        courtsById={courtsById}
                        opinionPdfUrl={opinionPdfUrl}
                        opinionDocument={opinionDocument}
                      />
                    </div>
                  ) : (
                    <Alert
                      type="info"
                      message="A PDF version is not available for this case."
                      showIcon
                    />
                  ),
                },
              ]}
            />
          )}
        </div>
      ) : (
        <Alert type="warning" message="Case not found" showIcon />
      )}
    </div>
  );
};

export default OpinionCaseDetailLayer;
