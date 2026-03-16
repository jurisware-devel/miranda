import React, { useState } from "react";
import { Checkbox, Empty } from "antd";
import type { OpinionDocument } from "../../core/opinions/types";
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
  const [showAppearances, setShowAppearances] = useState(false);
  const [showFootnotes, setShowFootnotes] = useState(true);
  const [showPageMarkers, setShowPageMarkers] = useState(true);
  const writings = document.opinions?.filter(Boolean) ?? [];
  const hasPageMarkers = Boolean(document.renderingHints?.hasOfficialPageMarkers);

  return (
    <div className="case-detail__opinion-content opinion-document">
      <OpinionHeader
        document={document}
        fallbackTitle={fallbackTitle}
        fallbackSlipOpinion={fallbackSlipOpinion}
        fallbackOfficialCitation={fallbackOfficialCitation}
        fallbackCourt={fallbackCourt}
        fallbackDecisionDate={fallbackDecisionDate}
      />
      <div className="opinion-preferences" role="group" aria-label="Opinion display preferences">
        <Checkbox checked={showAppearances} onChange={(event) => setShowAppearances(event.target.checked)}>
          Appearances
        </Checkbox>
        <Checkbox checked={showFootnotes} onChange={(event) => setShowFootnotes(event.target.checked)}>
          Footnotes
        </Checkbox>
        {hasPageMarkers ? (
          <Checkbox checked={showPageMarkers} onChange={(event) => setShowPageMarkers(event.target.checked)}>
            Page markers
          </Checkbox>
        ) : null}
      </div>
      {showAppearances ? <OpinionAppearances appearances={document.appearances} /> : null}
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
      {showFootnotes ? (
        <FootnotesPanel footnotes={document.footnotes} opinionSourceUrl={opinionSourceUrl} />
      ) : null}
      {hasPageMarkers && showPageMarkers ? (
        <p className="opinion-page-markers__placeholder">
          Official page markers are indicated in the source data, but page-marker nodes are not yet rendered.
        </p>
      ) : null}
    </div>
  );
};

export default OpinionDocumentView;
