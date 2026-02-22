import React from "react";
import { Link, useParams } from "react-router-dom";

type AdminCaseToolsPageProps = {
  isCondensedLayout?: boolean;
};

const AdminCaseToolsPage: React.FC<AdminCaseToolsPageProps> = ({
  isCondensedLayout = false,
}) => {
  const { caseId } = useParams();
  const decodedCaseId = caseId ? decodeURIComponent(caseId) : "";
  const encodedCaseId = encodeURIComponent(decodedCaseId);

  return (
    <div className={`admin-placeholder${isCondensedLayout ? " admin-placeholder--condensed" : ""}`}>
      <div className="admin-placeholder__case-context" aria-label="Case context">
        <span className="admin-placeholder__case-label">Case ID</span>
        <code className="admin-placeholder__case-id">{decodedCaseId}</code>
      </div>
      <h1 className="admin-placeholder__title">Admin case tools</h1>
      <p className="admin-placeholder__description">
        Select an admin workflow for this case.
      </p>
      <div className="admin-case-tools__actions">
        <Link to={`/admin/cases/${encodedCaseId}/tags`}>Edit tags</Link>
        <Link to={`/admin/cases/${encodedCaseId}/opinion`}>Edit opinion</Link>
        <Link to={`/admin/cases/${encodedCaseId}/metadata`}>Edit metadata</Link>
      </div>
      <div className="admin-placeholder__actions">
        <Link to={`/case/${encodedCaseId}`}>View public case page</Link>
      </div>
    </div>
  );
};

export default AdminCaseToolsPage;
