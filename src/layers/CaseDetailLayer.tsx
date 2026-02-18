import React, { useEffect, useState } from "react";
import { Alert, Spin } from "antd";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { client } from "../logic/amplifyClient";
import type { CaseItem } from "../logic/types";
import { buildOpinionUrl } from "../logic/caseUtils";

type CaseDetailLayerProps = {
  cases: CaseItem[];
  loading: boolean;
  error: string | null;
};

const CaseDetailLayer: React.FC<CaseDetailLayerProps> = ({
  cases,
  loading,
  error,
}) => {
  const { caseId } = useParams();
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState<string>("");
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
      return;
    }

    async function loadOpinion() {
      try {
        setOpinionLoading(true);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load opinion (${response.status})`);
        }
        const text = await response.text();
        if (!active) return;
        setOpinionText(text);
        setOpinionError(null);
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

export default CaseDetailLayer;
