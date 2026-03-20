import React, { useEffect, useMemo, useRef, useState } from "react";
import { Empty } from "antd";
import type { OpinionDocument } from "../../../core/opinions/types";
import FootnotesPanel from "./FootnotesPanel";
import OpinionAppearances from "./OpinionAppearances";
import OpinionHeader from "./OpinionHeader";
import OpinionWriting from "./OpinionWriting";

type OpinionDocumentViewProps = {
  document: OpinionDocument;
  opinionSourceUrl?: string;
  fallbackTitle?: string | null;
  fallbackSlipOpinion?: string | null;
  fallbackOfficialCitation?: string | null;
  fallbackCourt?: string | null;
  fallbackDecisionDate?: string | null;
};

const OpinionDocumentView: React.FC<OpinionDocumentViewProps> = ({
  document,
  opinionSourceUrl,
  fallbackTitle,
  fallbackSlipOpinion,
  fallbackOfficialCitation,
  fallbackCourt,
  fallbackDecisionDate,
}) => {
  const [showHeader, setShowHeader] = useState(false);
  const [showFootnotes, setShowFootnotes] = useState(false);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const writings = document.opinions?.filter(Boolean) ?? [];
  const hasPageMarkers = Boolean(document.renderingHints?.hasOfficialPageMarkers);
  const hasFootnotes = Boolean(document.footnotes?.length);
  const hasAppearances = Boolean(document.appearances?.some((appearance) => appearance?.text?.trim()));
  const title = document.header?.title ?? fallbackTitle ?? "";
  const dispositionParts =
    typeof document.disposition === "string"
      ? [{ type: "action", text: document.disposition.trim() }]
      : (document.disposition?.parts
          ?.map((part) => ({
            type: part?.type?.trim() ?? "",
            text: part?.text?.trim() ?? "",
          }))
          .filter((part) => part.text) ?? []);
  const dispositionText =
    dispositionParts.length > 0
      ? ""
      : typeof document.disposition === "string"
        ? document.disposition.trim()
        : document.disposition?.text?.trim() ?? "";
  const bodyLabelId = useMemo(
    () => `opinion-body-${document.source?.caseId ?? "document"}`,
    [document.source?.caseId],
  );

  useEffect(() => {
    setShowFootnotes(false);
  }, [document.source?.caseId]);

  const handleHeaderToggle = () => {
    setShowHeader((value) => !value);
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div className="case-detail__opinion-content opinion-document">
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
      </section>

      <div className="opinion-document__main">
        <section className="opinion-document__body-shell" aria-labelledby={bodyLabelId}>
          <h2 id={bodyLabelId} className="sr-only">
            Body
          </h2>
          <div ref={bodyScrollRef} className="opinion-document__body-scroll">
            {showHeader ? (
              <div className="opinion-document__header-body opinion-document__header-body--inline" aria-label="Header">
                <OpinionHeader
                  document={document}
                  variant="details"
                  fallbackTitle={fallbackTitle}
                  fallbackSlipOpinion={fallbackSlipOpinion}
                  fallbackOfficialCitation={fallbackOfficialCitation}
                  fallbackCourt={fallbackCourt}
                  fallbackDecisionDate={fallbackDecisionDate}
                />
                {hasAppearances ? (
                  <OpinionAppearances appearances={document.appearances} />
                ) : null}
              </div>
            ) : null}
            {writings.length ? (
              writings.map((writing, index) => (
                <OpinionWriting
                  key={`${writing.label ?? writing.author ?? writing.kind ?? "writing"}-${index}`}
                  writing={writing}
                  index={index}
                  opinionSourceUrl={opinionSourceUrl}
                />
              ))
            ) : (
              <Empty description="Opinion content is not available." />
            )}
            {dispositionParts.length > 0 ? (
              <section className="opinion-document__disposition" aria-label="Disposition">
                {dispositionParts.map((part, index) => (
                  <p
                    key={`${part.type || "part"}-${index}`}
                    className="opinion-document__disposition-text"
                  >
                    {part.text}
                  </p>
                ))}
              </section>
            ) : dispositionText ? (
              <section className="opinion-document__disposition" aria-label="Disposition">
                <p className="opinion-document__disposition-text">{dispositionText}</p>
              </section>
            ) : null}
            {hasPageMarkers ? (
              <p className="opinion-page-markers__placeholder">
                Official page markers are indicated in the source data, but page-marker nodes are not yet rendered.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      {hasFootnotes ? (
        <section className="opinion-document__footnotes-shell" aria-labelledby="opinion-footnotes-shell-heading">
          <div className="opinion-document__section-bar">
            <h2 id="opinion-footnotes-shell-heading" className="opinion-document__section-heading">
              Footnotes
            </h2>
            <button
              type="button"
              className="opinion-document__toggle"
              onClick={() => setShowFootnotes((value) => !value)}
            >
              {showFootnotes ? "Hide" : "Show"}
            </button>
          </div>
          {showFootnotes ? (
            <FootnotesPanel
              footnotes={document.footnotes}
              opinionSourceUrl={opinionSourceUrl}
              showTitle={false}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
};

export default OpinionDocumentView;
