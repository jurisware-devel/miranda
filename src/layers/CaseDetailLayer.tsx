import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { client } from "../logic/amplifyClient";
import type { CaseItem } from "../logic/types";
import { buildOpinionUrl, formatCaseCaption } from "../logic/caseUtils";

type CaseDetailLayerProps = {
  cases: CaseItem[];
  filteredCases: CaseItem[];
  loading: boolean;
  error: string | null;
};

const CaseDetailLayer: React.FC<CaseDetailLayerProps> = ({
  cases,
  filteredCases,
  loading,
  error,
}) => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState<string>("");
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);

  const filteredIndex = useMemo(() => {
    if (!caseId) return -1;
    return filteredCases.findIndex((item) => item.caseId === caseId);
  }, [caseId, filteredCases]);

  const prevCase = filteredIndex > 0 ? filteredCases[filteredIndex - 1] : null;
  const nextCase =
    filteredIndex >= 0 && filteredIndex < filteredCases.length - 1
      ? filteredCases[filteredIndex + 1]
      : null;

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
        const result = await client.models.Case.get({ caseId: caseIdValue });
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
    const url = buildOpinionUrl(caseItem?.opinionUrl);
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
  }, [caseItem?.opinionUrl]);

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
          <div className="case-detail__bar">
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button
              type="text"
              className="case-detail__caption-button case-detail__caption-button--prev"
              disabled={!prevCase}
              onClick={() => prevCase && navigate(`/case/${prevCase.caseId}`)}
            >
              Previous
            </Button>
            <div className="case-detail__title">{formatCaseCaption(caseItem)}</div>
            <Button
              type="text"
              className="case-detail__caption-button case-detail__caption-button--next"
              disabled={!nextCase}
              onClick={() => nextCase && navigate(`/case/${nextCase.caseId}`)}
            >
              Next
            </Button>
          </div>

          <div className="case-detail__body case-detail__body--full">
            <div className="case-detail__text">
              {opinionError ? (
                <Alert type="error" message={opinionError} showIcon />
              ) : opinionLoading ? (
                <div className="card-grid__loading">
                  <Spin />
                </div>
              ) : opinionText ? (
                <div className="case-detail__opinion">
                  <div className="case-detail__opinion-content">
                    <ReactMarkdown>{opinionText}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="case-detail__opinion">
                  <div className="case-detail__placeholder" aria-hidden="true">
                    <div className="case-detail__placeholder-line case-detail__placeholder-line--long" />
                    <div className="case-detail__placeholder-line case-detail__placeholder-line--medium" />
                    <div className="case-detail__placeholder-line case-detail__placeholder-line--long" />
                    <div className="case-detail__placeholder-line case-detail__placeholder-line--short" />
                    <div className="case-detail__placeholder-line case-detail__placeholder-line--long" />
                    <div className="case-detail__placeholder-line case-detail__placeholder-line--medium" />
                    <div className="case-detail__placeholder-line case-detail__placeholder-line--long" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Alert type="warning" message="Case not found" showIcon />
      )}
    </div>
  );
};

export default CaseDetailLayer;
