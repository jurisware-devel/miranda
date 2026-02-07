import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Input, Select, Spin, Switch } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { client } from "../logic/amplifyClient";
import type { CaseItem, CaseTagItem, TagItem } from "../logic/types";
import {
  buildOpinionUrl,
  normalizeDate,
  normalizeNullableField,
} from "../logic/caseUtils";
import { buildTagOptions, mapTagsById } from "../logic/tagUtils";

type CaseDetailLayerProps = {
  cases: CaseItem[];
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
  ai_review: boolean;
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
  ai_review: true,
};

const CaseDetailLayer: React.FC<CaseDetailLayerProps> = ({
  cases,
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
  const [formState, setFormState] = useState<CaseFormState>(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const tagOptions = useMemo(() => buildTagOptions(tags), [tags]);

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
      ai_review: item.ai_review ?? true,
    });
  };

  useEffect(() => {
    if (!caseItem) return;
    resetFormState(caseItem);
  }, [caseItem]);

  useEffect(() => {
    if (!caseItem) return;
    const nextTagIds = caseTags
      .filter((item) => item.caseId === caseItem.caseId)
      .map((item) => item.tagId)
      .sort((a, b) =>
        (tagsById.get(a) ?? "").localeCompare(tagsById.get(b) ?? "", undefined, {
          sensitivity: "base",
        }),
      );
    setSelectedTagIds(nextTagIds);
  }, [caseItem, caseTags, tagsById]);

  const handleSave = async () => {
    if (!canEdit) return false;
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
        ai_review: formState.ai_review,
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
  };

  return (
    <div className="case-detail">
      <div className="case-detail__bar">
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </div>
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {caseError ? <Alert type="error" message={caseError} showIcon /> : null}
      {saveError ? <Alert type="error" message={saveError} showIcon /> : null}
      {saveSuccess ? <Alert type="success" message={saveSuccess} showIcon /> : null}
      {loading || caseLoading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : caseItem ? (
        <div className="case-detail__panel">
          <div className="case-detail__body">
            <div className="case-detail__text">
              {opinionError ? (
                <Alert type="error" message={opinionError} showIcon />
              ) : opinionLoading ? (
                <div className="card-grid__loading">
                  <Spin />
                </div>
              ) : (
                <pre>{opinionText}</pre>
              )}
            </div>
            <div className="case-detail__side">
              <div className="case-detail__form">
                <div className="case-detail__form-grid">
                  {!canEdit ? (
                    <div className="case-detail__readonly">Read-only access</div>
                  ) : null}
                <div className="case-detail__form-row">
                  <label>Case Name</label>
                  <Input
                    value={formState.caseName}
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        summary: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="case-detail__form-row">
                  <label>AI Review</label>
                  <Switch
                    className="case-detail__switch"
                    checked={formState.ai_review}
                    disabled={!canEdit}
                    onChange={(checked) =>
                      setFormState((prev) => ({
                        ...prev,
                        ai_review: checked,
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
                    disabled={!canEdit}
                    onChange={(value) => {
                      const next = (value as string[]).slice().sort((a, b) =>
                        (tagsById.get(a) ?? "").localeCompare(
                          tagsById.get(b) ?? "",
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
                    disabled={!canEdit}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        partiesCaption: event.target.value,
                      }))
                    }
                  />
                </div>
                </div>
                {canEdit ? (
                  <div className="case-detail__form-actions">
                    <Button onClick={handleCancelEdit}>Cancel</Button>
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
                ) : null}
              </div>
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
