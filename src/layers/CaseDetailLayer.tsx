import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Select, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { client } from "../logic/amplifyClient";
import type { CaseItem, CaseTagItem, TagItem } from "../logic/types";
import {
  buildOpinionUrl,
  formatCaseCaption,
  normalizeDate,
  normalizeNullableField,
} from "../logic/caseUtils";
import { buildTagOptions, mapTagsById } from "../logic/tagUtils";

type CaseDetailLayerProps = {
  cases: CaseItem[];
  filteredCases: CaseItem[];
  loading: boolean;
  error: string | null;
  tags: TagItem[];
  caseTags: CaseTagItem[];
  canEdit: boolean;
  onCaseUpdated?: (updated: CaseItem) => void;
  onCaseTagsUpdated?: (caseId: string, nextCaseTags: CaseTagItem[]) => void;
};

type CaseFormState = {
  caseName: string;
  slipOp: string;
  ny3dCite: string;
  court: string;
  decisionDate: string;
  arguedDate: string;
  correctedDate: string;
  lowerCourtCite: string;
  disposition: string;
  authoringJudge: string;
  partiesCaption: string;
  summary: string;
};

const emptyForm: CaseFormState = {
  caseName: "",
  slipOp: "",
  ny3dCite: "",
  court: "",
  decisionDate: "",
  arguedDate: "",
  correctedDate: "",
  lowerCourtCite: "",
  disposition: "",
  authoringJudge: "",
  partiesCaption: "",
  summary: "",
};

const CaseDetailLayer: React.FC<CaseDetailLayerProps> = ({
  cases,
  filteredCases,
  loading,
  error,
  tags,
  caseTags,
  canEdit,
  onCaseUpdated,
  onCaseTagsUpdated,
}) => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState<string>("");
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);
  const [opinionDraft, setOpinionDraft] = useState<string>("");
  const [opinionEditing, setOpinionEditing] = useState(false);
  const [opinionSaving, setOpinionSaving] = useState(false);
  const [opinionSaveError, setOpinionSaveError] = useState<string | null>(null);
  const [opinionSaveSuccess, setOpinionSaveSuccess] = useState<string | null>(
    null,
  );
  const [formState, setFormState] = useState<CaseFormState>(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const tagOptions = useMemo(() => buildTagOptions(tags), [tags]);
  const filteredIndex = useMemo(() => {
    if (!caseId) return -1;
    return filteredCases.findIndex((item) => item.caseId === caseId);
  }, [caseId, filteredCases]);
  const prevCase =
    filteredIndex > 0 ? filteredCases[filteredIndex - 1] : null;
  const nextCase =
    filteredIndex >= 0 && filteredIndex < filteredCases.length - 1
      ? filteredCases[filteredIndex + 1]
      : null;

  useEffect(() => {
    let active = true;
    if (!caseId) return;
    const caseIdValue = caseId;
    const existing = cases.find((item) => item.caseId === caseId) ?? null;
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
        setOpinionDraft(text);
        setOpinionError(null);
      } catch (err) {
        if (!active) return;
        setOpinionError(
          err instanceof Error ? err.message : "Failed to load opinion text",
        );
      } finally {
        if (active) setOpinionLoading(false);
      }
    }
    void loadOpinion();
    return () => {
      active = false;
    };
  }, [caseItem?.opinionUrl]);

  const resetFormState = (item: CaseItem | null) => {
    if (!item) return;
    setFormState({
      caseName: item.caseName ?? "",
      slipOp: item.slipOp ?? "",
      ny3dCite: item.ny3dCite ?? "",
      court: item.court ?? "",
      decisionDate: normalizeDate(item.decisionDate),
      arguedDate: normalizeDate(item.arguedDate),
      correctedDate: normalizeDate(item.correctedDate),
      lowerCourtCite: item.lowerCourtCite ?? "",
      disposition: item.disposition ?? "",
      authoringJudge: item.authoringJudge ?? "",
      partiesCaption: item.partiesCaption ?? "",
      summary: item.summary ?? "",
    });
  };

  useEffect(() => {
    if (!caseItem) return;
    resetFormState(caseItem);
    setIsEditing(false);
    setOpinionEditing(false);
    setOpinionSaveError(null);
    setOpinionSaveSuccess(null);
  }, [caseItem]);

  useEffect(() => {
    if (!saveSuccess) return;
    setToastVisible(true);
    const handleDismiss = () => {
      setToastVisible(false);
      window.setTimeout(() => {
        setSaveSuccess(null);
      }, 200);
    };
    const autoDismiss = window.setTimeout(handleDismiss, 5000);
    document.addEventListener("pointerdown", handleDismiss);
    return () => {
      document.removeEventListener("pointerdown", handleDismiss);
      window.clearTimeout(autoDismiss);
    };
  }, [saveSuccess]);

  useEffect(() => {
    if (!caseItem) return;
    const nextTagIds = caseTags
      .filter((item) => item.caseId === caseItem.caseId)
      .map((item) => item.tagId)
      .sort((a, b) =>
        (tagsById.get(a)?.label ?? "").localeCompare(
          tagsById.get(b)?.label ?? "",
          undefined,
          {
            sensitivity: "base",
          },
        ),
      );
    setSelectedTagIds(nextTagIds);
  }, [caseItem, caseTags, tagsById]);

  const handleSave = async () => {
    if (!canEdit || !isEditing) return false;
    if (!caseItem) return false;
    try {
      setSaveLoading(true);
      setSaveError(null);
      setSaveSuccess(null);
      const payload = {
        caseId: caseItem.caseId,
        caseName: formState.caseName.trim() || caseItem.caseName,
        opinionUrl: caseItem.opinionUrl,
        slipOp: normalizeNullableField(formState.slipOp),
        ny3dCite: normalizeNullableField(formState.ny3dCite),
        court: formState.court.trim() || undefined,
        decisionDate: formState.decisionDate.trim() || undefined,
        arguedDate: normalizeNullableField(formState.arguedDate),
        correctedDate: normalizeNullableField(formState.correctedDate),
        lowerCourtCite: normalizeNullableField(formState.lowerCourtCite),
        disposition: normalizeNullableField(formState.disposition),
        authoringJudge: normalizeNullableField(formState.authoringJudge),
        partiesCaption: normalizeNullableField(formState.partiesCaption),
        summary: normalizeNullableField(formState.summary),
      };
      const result = await client.models.Case.update(payload);
      const updated = (result?.data ?? null) as CaseItem | null;
      const updatedCase = updated ?? ({ ...caseItem, ...payload } as CaseItem);
      setCaseItem(updatedCase);
      if (onCaseUpdated) {
        onCaseUpdated(updatedCase);
      }
      const existingTagIds = new Set(
        caseTags
          .filter((item) => item.caseId === caseItem.caseId)
          .map((item) => item.tagId),
      );
      const desiredTagIds = new Set(selectedTagIds);
      const toCreate = selectedTagIds.filter((tagId) => !existingTagIds.has(tagId));
      const toDelete = Array.from(existingTagIds).filter(
        (tagId) => !desiredTagIds.has(tagId),
      );
      if (toCreate.length || toDelete.length) {
        await Promise.all([
          ...toCreate.map((tagId) =>
            client.models.CaseTag.create({ caseId: caseItem.caseId, tagId }),
          ),
          ...toDelete.map((tagId) =>
            client.models.CaseTag.delete({ caseId: caseItem.caseId, tagId }),
          ),
        ]);
        if (onCaseTagsUpdated) {
          const retained = caseTags.filter(
            (item) =>
              item.caseId !== caseItem.caseId || desiredTagIds.has(item.tagId),
          );
          const created = toCreate.map(
            (tagId) => ({ caseId: caseItem.caseId, tagId }) as CaseTagItem,
          );
          onCaseTagsUpdated(caseItem.caseId, [...retained, ...created]);
        }
      }
      setSaveSuccess("Saved");
      setIsEditing(false);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      return false;
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    resetFormState(caseItem);
    setSaveError(null);
    setSaveSuccess(null);
    setIsEditing(false);
  };

  const handleSaveOpinion = async () => {
    if (!canEdit || !caseItem?.opinionUrl) return false;
    try {
      setOpinionSaving(true);
      setOpinionSaveError(null);
      setOpinionSaveSuccess(null);
      const result = await client.mutations.saveOpinionText({
        key: caseItem.opinionUrl,
        markdown: opinionDraft,
      });
      if (result?.data) {
        setOpinionText(opinionDraft);
        setOpinionSaveSuccess("Opinion saved");
      }
      setOpinionEditing(false);
      return true;
    } catch (err) {
      setOpinionSaveError(
        err instanceof Error ? err.message : "Failed to save opinion",
      );
      return false;
    } finally {
      setOpinionSaving(false);
    }
  };

  return (
    <div className="case-detail">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {caseError ? <Alert type="error" message={caseError} showIcon /> : null}
      {saveError ? <Alert type="error" message={saveError} showIcon /> : null}
      {saveSuccess ? (
        <button
          type="button"
          className={`case-detail__toast${
            toastVisible ? " case-detail__toast--visible" : ""
          }`}
          onClick={() => {
            setToastVisible(false);
            window.setTimeout(() => {
              setSaveSuccess(null);
            }, 200);
          }}
        >
          {saveSuccess}
        </button>
      ) : null}
      {loading || caseLoading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : caseItem ? (
        <div className="case-detail__panel">
          <div className="case-detail__bar">
            <Button
              icon={<ArrowLeftOutlined />}
              type="text"
              onClick={() => navigate(-1)}
            >
              Back
            </Button>
            <Button
              type="text"
              className="case-detail__caption-button case-detail__caption-button--prev"
              disabled={!prevCase}
              onClick={() => {
                if (prevCase) navigate(`/case/${prevCase.caseId}`);
              }}
            >
              Previous
            </Button>
            {caseItem ? (
              <div className="case-detail__title">{formatCaseCaption(caseItem)}</div>
            ) : null}
            <Button
              type="text"
              className="case-detail__caption-button case-detail__caption-button--next"
              disabled={!nextCase}
              onClick={() => {
                if (nextCase) navigate(`/case/${nextCase.caseId}`);
              }}
            >
              Next
            </Button>
          </div>
          <div
            className={`case-detail__body${
              canEdit ? " case-detail__body--admin" : " case-detail__body--full"
            }`}
          >
            <div className="case-detail__text">
              {opinionError ? (
                <Alert type="error" message={opinionError} showIcon />
              ) : opinionSaveError ? (
                <Alert type="error" message={opinionSaveError} showIcon />
              ) : opinionSaveSuccess ? (
                <Alert type="success" message={opinionSaveSuccess} showIcon />
              ) : opinionLoading ? (
                <div className="card-grid__loading">
                  <Spin />
                </div>
              ) : opinionEditing ? (
                <div className="case-detail__opinion-editor">
                  <Input.TextArea
                    rows={18}
                    value={opinionDraft}
                    onChange={(event) => setOpinionDraft(event.target.value)}
                  />
                  <div className="case-detail__opinion-actions">
                    <Button onClick={() => setOpinionEditing(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      loading={opinionSaving}
                      onClick={async () => {
                        await handleSaveOpinion();
                      }}
                    >
                      Save Opinion
                    </Button>
                  </div>
                </div>
              ) : opinionText ? (
                <div className="case-detail__opinion">
                  {canEdit ? (
                    <div className="case-detail__opinion-actions">
                      <Button onClick={() => setOpinionEditing(true)}>
                        Edit Opinion
                      </Button>
                    </div>
                  ) : null}
                  <ReactMarkdown>{opinionText}</ReactMarkdown>
                </div>
              ) : (
                <div className="case-detail__opinion">
                  {canEdit ? (
                    <div className="case-detail__opinion-actions">
                      <Button onClick={() => setOpinionEditing(true)}>
                        Edit Opinion
                      </Button>
                    </div>
                  ) : null}
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
            {canEdit ? (
              <div className="case-detail__side">
                <div className="case-detail__form">
                  <div className="case-detail__form-grid">
                <div className="case-detail__form-row">
                  <label>Case Name</label>
                  <Input
                    value={formState.caseName}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        caseName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Slip Citation</label>
                  <Input
                    value={formState.slipOp}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        slipOp: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>NY3d Citation</label>
                  <Input
                    value={formState.ny3dCite}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        ny3dCite: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Court</label>
                  <Input
                    value={formState.court}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        court: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Argued Date</label>
                  <Input
                    type="date"
                    value={formState.arguedDate}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        arguedDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Decision Date</label>
                  <Input
                    type="date"
                    value={formState.decisionDate}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        decisionDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Corrected Date</label>
                  <Input
                    type="date"
                    value={formState.correctedDate}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        correctedDate: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Lower Court Cite</label>
                  <Input
                    value={formState.lowerCourtCite}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        lowerCourtCite: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Disposition</label>
                  <Input
                    value={formState.disposition}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        disposition: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>Author</label>
                  <Input
                    value={formState.authoringJudge}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        authoringJudge: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row case-detail__form-row--full">
                  <label>Summary</label>
                  <Input.TextArea
                    rows={3}
                    value={formState.summary}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        summary: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row case-detail__form-row--full">
                  <label>Tags</label>
                  <Select
                    mode="multiple"
                    placeholder={tags.length ? "Select tags" : "Create tags first"}
                    value={selectedTagIds}
                    disabled={!canEdit || !isEditing}
                    onChange={(value) => {
                      const next = (value as string[]).slice().sort((a, b) =>
                        (tagsById.get(a)?.label ?? "").localeCompare(
                          tagsById.get(b)?.label ?? "",
                          undefined,
                          { sensitivity: "base" },
                        ),
                      );
                      setSelectedTagIds(next);
                    }}
                    options={tagOptions}
                  />
                </div>
                <div className="case-detail__form-row case-detail__form-row--full">
                  <label>Caption</label>
                  <Input.TextArea
                    rows={2}
                    value={formState.partiesCaption}
                    disabled={!canEdit || !isEditing}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        partiesCaption: event.target.value,
                      }))
                    }
                  />
                </div>
                </div>
                <div className="case-detail__form-actions">
                  {isEditing ? (
                    <>
                      <div className="case-detail__form-actions-left">
                        <Button onClick={handleCancelEdit}>Cancel</Button>
                      </div>
                      <div className="case-detail__form-actions-right">
                        <Button
                          type="primary"
                          loading={saveLoading}
                          onClick={async () => {
                            await handleSave();
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="case-detail__form-actions-right">
                      <Button onClick={() => setIsEditing(true)}>
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            ) : null}
          </div>
        </div>
      ) : (
        <Alert type="warning" message="Case not found" showIcon />
      )}
    </div>
  );
};

export default CaseDetailLayer;
