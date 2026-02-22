import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Select, Spin, message } from "antd";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { client } from "../core/amplifyClient";
import type { CaseItem } from "../core/types";
import { buildOpinionUrl } from "../core/utils/caseUtils";

type AdminCaseDetailLayerProps = {
  cases: CaseItem[];
  loading: boolean;
  error: string | null;
  isWideLayout: boolean;
};

type CaseMetadataDraft = {
  caseName: string;
  slipOp: string;
  ny3dCite: string;
  opinionUrl: string;
  court: string;
  decisionDate: string;
  arguedDate: string;
  correctedDate: string;
  citation: string;
  lowerCourtCite: string;
  disposition: string;
  authoringJudge: string;
  partiesCaption: string;
  statutesCited: string;
  summary: string;
};

const EMPTY_METADATA_DRAFT: CaseMetadataDraft = {
  caseName: "",
  slipOp: "",
  ny3dCite: "",
  opinionUrl: "",
  court: "",
  decisionDate: "",
  arguedDate: "",
  correctedDate: "",
  citation: "",
  lowerCourtCite: "",
  disposition: "",
  authoringJudge: "",
  partiesCaption: "",
  statutesCited: "",
  summary: "",
};

const toDateInput = (value: string | null | undefined): string => value ?? "";
const toNullableString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};
const toNullableDate = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toDraft = (value: CaseItem | null): CaseMetadataDraft => {
  if (!value) return EMPTY_METADATA_DRAFT;
  return {
    caseName: value.caseName ?? "",
    slipOp: value.slipOp ?? "",
    ny3dCite: value.ny3dCite ?? "",
    opinionUrl: value.opinionUrl ?? "",
    court: value.court ?? "",
    decisionDate: toDateInput(value.decisionDate),
    arguedDate: toDateInput(value.arguedDate),
    correctedDate: toDateInput(value.correctedDate),
    citation: value.citation ?? "",
    lowerCourtCite: value.lowerCourtCite ?? "",
    disposition: value.disposition ?? "",
    authoringJudge: value.authoringJudge ?? "",
    partiesCaption: value.partiesCaption ?? "",
    statutesCited: (value.statutesCited ?? []).join(", "),
    summary: value.summary ?? "",
  };
};

const AdminCaseDetailLayer: React.FC<AdminCaseDetailLayerProps> = ({
  cases,
  loading,
  error,
  isWideLayout,
}) => {
  const { caseId } = useParams();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState<string>("");
  const [opinionPdfUrl, setOpinionPdfUrl] = useState<string>("");
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState<CaseMetadataDraft>(EMPTY_METADATA_DRAFT);

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
        const result = await client.models.Case.get(
          { caseId: caseIdValue },
          { authMode: "userPool" },
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

  useEffect(() => {
    setMetadataDraft(toDraft(caseItem));
    setIsEditingMetadata(false);
  }, [caseItem]);

  const handleMetadataFieldChange = (field: keyof CaseMetadataDraft, value: string) => {
    setMetadataDraft((current) => ({ ...current, [field]: value }));
  };

  const handleEditMetadata = () => {
    setMetadataDraft(toDraft(caseItem));
    setIsEditingMetadata(true);
  };

  const handleCancelEditMetadata = () => {
    setMetadataDraft(toDraft(caseItem));
    setIsEditingMetadata(false);
  };

  const handleSaveMetadata = async () => {
    if (!caseItem) return;
    if (!metadataDraft.caseName.trim()) {
      message.error("Case name is required.");
      return;
    }
    if (!metadataDraft.opinionUrl.trim()) {
      message.error("Opinion URL is required.");
      return;
    }

    try {
      setIsSavingMetadata(true);
      const statutesCited = metadataDraft.statutesCited
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const updatePayload = {
        caseId: caseItem.caseId,
        caseName: metadataDraft.caseName.trim(),
        slipOp: toNullableString(metadataDraft.slipOp),
        ny3dCite: toNullableString(metadataDraft.ny3dCite),
        opinionUrl: metadataDraft.opinionUrl.trim(),
        court: (metadataDraft.court.trim() || null) as CaseItem["court"],
        decisionDate: toNullableDate(metadataDraft.decisionDate),
        arguedDate: toNullableDate(metadataDraft.arguedDate),
        correctedDate: toNullableDate(metadataDraft.correctedDate),
        citation: toNullableString(metadataDraft.citation),
        lowerCourtCite: toNullableString(metadataDraft.lowerCourtCite),
        disposition: toNullableString(metadataDraft.disposition),
        authoringJudge: toNullableString(metadataDraft.authoringJudge),
        partiesCaption: toNullableString(metadataDraft.partiesCaption),
        statutesCited: statutesCited.length ? statutesCited : null,
        summary: toNullableString(metadataDraft.summary),
      };

      const result = await client.models.Case.update(updatePayload, { authMode: "userPool" });
      if (result.errors?.length) {
        throw new Error(result.errors[0]?.message ?? "Failed to save case metadata");
      }

      const updatedCase = (result.data ?? null) as CaseItem | null;
      if (updatedCase) {
        setCaseItem(updatedCase);
        setMetadataDraft(toDraft(updatedCase));
      }
      setIsEditingMetadata(false);
      message.success("Case metadata saved.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to save case metadata");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  return (
    <div className="case-detail">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {caseError ? <Alert type="error" message={caseError} showIcon /> : null}
      {loading || caseLoading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : caseItem ? (
        <div className={`case-detail__layout${isWideLayout ? " case-detail__layout--wide" : ""}`}>
          <div ref={panelRef} className="case-detail__panel">
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
          {isWideLayout ? (
            <aside className="case-metadata-panel" aria-label="Case metadata panel">
              <div className="case-metadata-panel__header">
                <h2>Case Metadata</h2>
              </div>
              <div className="case-metadata-panel__fields">
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-case-id">Case ID</label>
                  <Input id="case-meta-case-id" value={caseItem.caseId ?? ""} disabled />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-case-name">Case Name</label>
                  <Input
                    id="case-meta-case-name"
                    value={metadataDraft.caseName}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("caseName", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-court">Court</label>
                  <Select
                    id="case-meta-court"
                    value={metadataDraft.court || undefined}
                    disabled={!isEditingMetadata}
                    allowClear
                    onChange={(value) => handleMetadataFieldChange("court", value ?? "")}
                    options={[
                      { value: "scotus", label: "SCOTUS" },
                      { value: "coa", label: "COA" },
                      { value: "ad3", label: "AD3" },
                      { value: "albany", label: "Albany" },
                    ]}
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-opinion-url">Opinion URL</label>
                  <Input
                    id="case-meta-opinion-url"
                    value={metadataDraft.opinionUrl}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("opinionUrl", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-decision-date">Decision Date</label>
                  <Input
                    id="case-meta-decision-date"
                    type="date"
                    value={metadataDraft.decisionDate}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("decisionDate", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-argued-date">Argued Date</label>
                  <Input
                    id="case-meta-argued-date"
                    type="date"
                    value={metadataDraft.arguedDate}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("arguedDate", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-corrected-date">Corrected Date</label>
                  <Input
                    id="case-meta-corrected-date"
                    type="date"
                    value={metadataDraft.correctedDate}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("correctedDate", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-citation">Citation</label>
                  <Input
                    id="case-meta-citation"
                    value={metadataDraft.citation}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("citation", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-ny3d-cite">NY3d Cite</label>
                  <Input
                    id="case-meta-ny3d-cite"
                    value={metadataDraft.ny3dCite}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("ny3dCite", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-slip-op">Slip Op</label>
                  <Input
                    id="case-meta-slip-op"
                    value={metadataDraft.slipOp}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("slipOp", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-lower-court-cite">Lower Court Cite</label>
                  <Input
                    id="case-meta-lower-court-cite"
                    value={metadataDraft.lowerCourtCite}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("lowerCourtCite", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-disposition">Disposition</label>
                  <Input
                    id="case-meta-disposition"
                    value={metadataDraft.disposition}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("disposition", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-authoring-judge">Authoring Judge</label>
                  <Input
                    id="case-meta-authoring-judge"
                    value={metadataDraft.authoringJudge}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("authoringJudge", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-parties-caption">Parties Caption</label>
                  <Input.TextArea
                    id="case-meta-parties-caption"
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={metadataDraft.partiesCaption}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("partiesCaption", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-statutes-cited">Statutes Cited (comma-separated)</label>
                  <Input.TextArea
                    id="case-meta-statutes-cited"
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    value={metadataDraft.statutesCited}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("statutesCited", event.target.value)
                    }
                  />
                </div>
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-summary">Summary</label>
                  <Input.TextArea
                    id="case-meta-summary"
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    value={metadataDraft.summary}
                    disabled={!isEditingMetadata}
                    onChange={(event) =>
                      handleMetadataFieldChange("summary", event.target.value)
                    }
                  />
                </div>
              </div>
              <div
                className={`case-metadata-panel__actions${
                  isEditingMetadata ? " case-metadata-panel__actions--editing" : ""
                }`}
              >
                {isEditingMetadata ? (
                  <>
                    <Button onClick={handleCancelEditMetadata} disabled={isSavingMetadata}>
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      onClick={handleSaveMetadata}
                      loading={isSavingMetadata}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <Button type="primary" onClick={handleEditMetadata}>
                    Edit
                  </Button>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      ) : (
        <Alert type="warning" message="Case not found" showIcon />
      )}
    </div>
  );
};

export default AdminCaseDetailLayer;
