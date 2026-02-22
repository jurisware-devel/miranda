import React, { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { client } from "../core/amplifyClient";
import type { CaseItem } from "../core/types";
import { buildOpinionUrl } from "../core/utils/caseUtils";

type SubCaseDetailLayerProps = {
  cases: CaseItem[];
  loading: boolean;
  error: string | null;
};

const SubCaseDetailLayer: React.FC<SubCaseDetailLayerProps> = ({ cases, loading, error }) => {
  const { caseId } = useParams();
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState<string>("");
  const [opinionPdfUrl, setOpinionPdfUrl] = useState<string>("");
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);

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
        const result = await client.models.Case.get(
          { caseId: caseIdValue },
          { authMode: "iam" },
        );
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
    const url = buildOpinionUrl(caseItem?.opinionUrl, caseItem);
    if (!url) {
      setOpinionText("");
      setOpinionPdfUrl("");
      return;
    }

    const hasKnownExtension = /\.(md|pdf)$/i.test(url);
    const candidateUrls = hasKnownExtension ? [url] : [`${url}.md`, `${url}.pdf`, url];

    async function loadOpinion() {
      try {
        setOpinionLoading(true);
        setOpinionError(null);
        setOpinionText("");
        setOpinionPdfUrl("");

        let lastStatus = "";
        for (const candidate of candidateUrls) {
          const response = await fetch(candidate);
          if (!response.ok) {
            lastStatus = String(response.status);
            continue;
          }

          const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
          const isPdf = /\.pdf($|\?)/i.test(candidate) || contentType.includes("application/pdf");
          if (!active) return;
          if (isPdf) {
            setOpinionPdfUrl(candidate);
            return;
          }

          const text = await response.text();
          if (!active) return;
          setOpinionText(text);
          return;
        }

        throw new Error(`Failed to load opinion${lastStatus ? ` (${lastStatus})` : ""}`);
      } catch (err) {
        if (!active) return;
        setOpinionError(err instanceof Error ? err.message : "Failed to load opinion text");
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
        <div className="case-detail__panel">
          {opinionError ? (
            <Alert type="error" message={opinionError} showIcon />
          ) : opinionLoading ? (
            <div className="card-grid__loading">
              <Spin />
            </div>
          ) : opinionText ? (
            <div className="case-detail__opinion-content">
              <ReactMarkdown>{opinionText}</ReactMarkdown>
            </div>
          ) : opinionPdfUrl ? (
            <div className="case-detail__opinion-content">
              <iframe
                title="Opinion PDF"
                src={opinionPdfUrl}
                style={{ width: "100%", minHeight: "80vh", border: 0 }}
              />
            </div>
          ) : (
            <>
              <div
                aria-hidden="true"
                className="case-detail__placeholder-line case-detail__placeholder-line--long"
              />
              <div
                aria-hidden="true"
                className="case-detail__placeholder-line case-detail__placeholder-line--medium"
              />
              <div
                aria-hidden="true"
                className="case-detail__placeholder-line case-detail__placeholder-line--long"
              />
              <div
                aria-hidden="true"
                className="case-detail__placeholder-line case-detail__placeholder-line--short"
              />
              <div
                aria-hidden="true"
                className="case-detail__placeholder-line case-detail__placeholder-line--long"
              />
              <div
                aria-hidden="true"
                className="case-detail__placeholder-line case-detail__placeholder-line--medium"
              />
              <div
                aria-hidden="true"
                className="case-detail__placeholder-line case-detail__placeholder-line--long"
              />
            </>
          )}
        </div>
      ) : (
        <Alert type="warning" message="Case not found" showIcon />
      )}
    </div>
  );
};

export default SubCaseDetailLayer;
