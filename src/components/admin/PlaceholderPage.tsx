import React from "react";
import { Link, useParams } from "react-router-dom";

type AdminPlaceholderPageProps = {
  title: string;
  description: string;
  isCondensedLayout?: boolean;
  backPathOverride?: string;
  backLabel?: string;
};

const AdminPlaceholderPage: React.FC<AdminPlaceholderPageProps> = ({
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
    (decodedCaseId ? `/admin/cases/${encodeURIComponent(decodedCaseId)}` : "/admin");

  return (
    <div
      className={`admin-placeholder${isCondensedLayout ? " admin-placeholder--condensed" : ""}`}
    >
      {decodedCaseId ? (
        <div className="admin-placeholder__case-context" aria-label="Case context">
          <span className="admin-placeholder__case-label">Case ID</span>
          <code className="admin-placeholder__case-id">{decodedCaseId}</code>
        </div>
      ) : null}
      <h1 className="admin-placeholder__title">{title}</h1>
      <p className="admin-placeholder__description">{description}</p>
      <div className="admin-placeholder__actions">
        <Link to={backPath}>{backLabel}</Link>
      </div>
    </div>
  );
};

export default AdminPlaceholderPage;
