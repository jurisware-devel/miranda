import React from "react";
import { Link, useParams } from "react-router-dom";

type SubPlaceholderPageProps = {
  title: string;
  description: string;
  isCondensedLayout?: boolean;
  backPathOverride?: string;
  backLabel?: string;
};

const SubPlaceholderPage: React.FC<SubPlaceholderPageProps> = ({
  title,
  description,
  isCondensedLayout = false,
  backPathOverride,
  backLabel = "Back",
}) => {
  const { caseId } = useParams();
  const decodedCaseId = caseId ? decodeURIComponent(caseId) : null;
  const backPath =
    backPathOverride ??
    (decodedCaseId ? `/sub/case/${encodeURIComponent(decodedCaseId)}` : "/sub");

  return (
    <div
      className={`sub-placeholder${isCondensedLayout ? " sub-placeholder--condensed" : ""}`}
    >
      {decodedCaseId ? (
        <div className="sub-placeholder__case-context" aria-label="Case context">
          <span className="sub-placeholder__case-label">Case ID</span>
          <code className="sub-placeholder__case-id">{decodedCaseId}</code>
        </div>
      ) : null}
      <h1 className="sub-placeholder__title">{title}</h1>
      <p className="sub-placeholder__description">{description}</p>
      <div className="sub-placeholder__actions">
        <Link to={backPath}>{backLabel}</Link>
      </div>
    </div>
  );
};

export default SubPlaceholderPage;
