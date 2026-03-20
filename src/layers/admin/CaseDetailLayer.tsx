import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Select, Spin, message } from "antd";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { client } from "../../core/amplifyClient";
import type {
  CaseItem,
  CasePhaseItem,
  CaseTagItem,
  CourtItem,
  PhaseItem,
  TagItem,
} from "../../core/types";
import {
  buildOpinionCandidateUrls,
  buildOpinionDocumentCandidateUrls,
  buildOpinionStorageKey,
  extractOpinionStorageKeyFromUrl,
  formatCaseCitationLine,
  getCourtLongLabel,
} from "../../core/utils/caseUtils";
import { getReadableTextColor } from "../../core/utils/colorUtils";
import { preserveNumericReferencePrefixes } from "../../core/utils/opinionMarkdown";
import { buildTagOptions, mapTagsById } from "../../core/utils/tagUtils";
import AdminTagCapsule from "../../components/admin/TagCapsule";

type AdminCaseDetailLayerProps = {
  cases: CaseItem[];
  courts: CourtItem[];
  courtsById: Map<string, CourtItem>;
  tags: TagItem[];
  phases: PhaseItem[];
  caseTags: CaseTagItem[];
  setCaseTags: React.Dispatch<React.SetStateAction<CaseTagItem[]>>;
  casePhases: CasePhaseItem[];
  setCasePhases: React.Dispatch<React.SetStateAction<CasePhaseItem[]>>;
  canEditCaseTags: boolean;
  loading: boolean;
  error: string | null;
  phasesError: string | null;
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
  courts,
  courtsById,
  tags,
  phases,
  caseTags,
  setCaseTags,
  casePhases,
  setCasePhases,
  canEditCaseTags,
  loading,
  error,
  phasesError,
  isWideLayout,
}) => {
  const { caseId } = useParams();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const opinionEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [caseItem, setCaseItem] = useState<CaseItem | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [opinionText, setOpinionText] = useState<string>("");
  const [opinionPdfUrl, setOpinionPdfUrl] = useState<string>("");
  const [opinionJsonText, setOpinionJsonText] = useState<string>("");
  const [opinionJsonSourceUrl, setOpinionJsonSourceUrl] = useState<string>("");
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [opinionError, setOpinionError] = useState<string | null>(null);
  const [showJsonInspector, setShowJsonInspector] = useState(false);
  const [isEditingOpinion, setIsEditingOpinion] = useState(false);
  const [isSavingOpinion, setIsSavingOpinion] = useState(false);
  const [opinionDraft, setOpinionDraft] = useState<string>("");
  const [opinionSavedAt, setOpinionSavedAt] = useState<string | null>(null);
  const [opinionSelection, setOpinionSelection] = useState({ start: 0, end: 0 });
  const [loadedOpinionKey, setLoadedOpinionKey] = useState<string>("");
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataDraft, setMetadataDraft] = useState<CaseMetadataDraft>(EMPTY_METADATA_DRAFT);
  const [tagDraftIds, setTagDraftIds] = useState<string[]>([]);
  const [initialTagIds, setInitialTagIds] = useState<string[]>([]);
  const [phaseDraftIds, setPhaseDraftIds] = useState<string[]>([]);
  const [initialPhaseIds, setInitialPhaseIds] = useState<string[]>([]);
  const renderedOpinionText = preserveNumericReferencePrefixes(opinionText);
  const tagsById = useMemo(() => mapTagsById(tags), [tags]);
  const sortedTagOptions = useMemo(() => buildTagOptions(tags), [tags]);
  const sortedPhaseOptions = useMemo(
    () =>
      [...phases]
        .sort((a, b) =>
          (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER) ||
          (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
        )
        .map((phase) => ({ value: phase.phaseId, label: phase.label ?? phase.phaseId })),
    [phases],
  );
  const caseTagIds = useMemo(
    () =>
      caseItem
        ? [
            ...new Set(
              caseTags.filter((item) => item.caseId === caseItem.caseId).map((item) => item.tagId),
            ),
          ]
        : [],
    [caseItem, caseTags],
  );
  const casePhaseIds = useMemo(
    () =>
      caseItem
        ? [
            ...new Set(
              casePhases
                .filter((item) => item.caseId === caseItem.caseId)
                .map((item) => item.phaseId),
            ),
          ]
        : [],
    [caseItem, casePhases],
  );

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
    const candidateUrls = buildOpinionCandidateUrls(caseItem?.opinionUrl, caseItem);
    const jsonCandidateUrls = buildOpinionDocumentCandidateUrls(caseItem?.opinionUrl, caseItem).filter(
      (candidateUrl) => /\.json($|\?)/i.test(candidateUrl),
    );
    if (!candidateUrls.length) {
      setOpinionText("");
      setOpinionPdfUrl("");
      setOpinionJsonText("");
      setOpinionJsonSourceUrl("");
      setShowJsonInspector(false);
      return;
    }

    async function loadOpinion() {
      try {
        setOpinionLoading(true);
        setOpinionError(null);
        setOpinionText("");
        setOpinionPdfUrl("");
        setOpinionJsonText("");
        setOpinionJsonSourceUrl("");
        setShowJsonInspector(false);
        setLoadedOpinionKey("");

        for (const candidate of jsonCandidateUrls) {
          const response = await fetch(candidate);
          if (!response.ok) continue;
          const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
          const isJson = /\.json($|\?)/i.test(candidate) || contentType.includes("application/json");
          if (!isJson) continue;
          const rawJson = await response.text();
          if (!active) return;
          setOpinionJsonText(rawJson);
          setOpinionJsonSourceUrl(candidate);
          break;
        }

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
            setLoadedOpinionKey(extractOpinionStorageKeyFromUrl(candidate));
            return;
          }

          const text = await response.text();
          if (!active) return;
          setOpinionText(text);
          setLoadedOpinionKey(extractOpinionStorageKeyFromUrl(candidate));
          setOpinionDraft(text);
          setIsEditingOpinion(false);
          setOpinionSavedAt(null);
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

  useEffect(() => {
    const sorted = [...caseTagIds].sort((a, b) =>
      (tagsById.get(a)?.label ?? "").localeCompare(tagsById.get(b)?.label ?? "", undefined, {
        sensitivity: "base",
      }),
    );
    setInitialTagIds(sorted);
    setTagDraftIds(sorted);
  }, [caseItem?.caseId, caseTagIds, tagsById]);

  useEffect(() => {
    const labelById = new Map(phases.map((phase) => [phase.phaseId, phase.label ?? phase.phaseId]));
    const orderById = new Map(phases.map((phase) => [phase.phaseId, phase.sort_order ?? Number.MAX_SAFE_INTEGER]));
    const sorted = [...casePhaseIds].sort((a, b) =>
      (orderById.get(a) ?? Number.MAX_SAFE_INTEGER) - (orderById.get(b) ?? Number.MAX_SAFE_INTEGER) ||
      (labelById.get(a) ?? "").localeCompare(labelById.get(b) ?? "", undefined, { sensitivity: "base" }),
    );
    setInitialPhaseIds(sorted);
    setPhaseDraftIds(sorted);
  }, [caseItem?.caseId, casePhaseIds, phases]);

  useEffect(() => {
    if (!isWideLayout && isEditingOpinion) {
      setIsEditingOpinion(false);
      setOpinionDraft(opinionText);
    }
  }, [isWideLayout, isEditingOpinion, opinionText]);

  const handleMetadataFieldChange = (field: keyof CaseMetadataDraft, value: string) => {
    setMetadataDraft((current) => ({ ...current, [field]: value }));
  };

  const handleEditMetadata = () => {
    setMetadataDraft(toDraft(caseItem));
    setPhaseDraftIds(initialPhaseIds);
    setIsEditingMetadata(true);
  };

  const handleCancelEditMetadata = () => {
    setMetadataDraft(toDraft(caseItem));
    setPhaseDraftIds(initialPhaseIds);
    setIsEditingMetadata(false);
  };

  const saveCaseTags = async (caseIdValue: string) => {
    const initial = new Set(initialTagIds);
    const draft = new Set(tagDraftIds);
    const createIds = [...draft].filter((tagId) => !initial.has(tagId));
    const deleteIds = [...initial].filter((tagId) => !draft.has(tagId));

    if (!createIds.length && !deleteIds.length) {
      return false;
    }

    for (const tagId of createIds) {
      const result = await client.models.CaseTag.create(
        { caseId: caseIdValue, tagId },
        { authMode: "userPool" },
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0]?.message ?? "Failed to create case tag");
      }
    }

    for (const tagId of deleteIds) {
      const result = await client.models.CaseTag.delete(
        { caseId: caseIdValue, tagId },
        { authMode: "userPool" },
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0]?.message ?? "Failed to delete case tag");
      }
    }

    setCaseTags((current) => {
      const withoutDeleted = current.filter(
        (item) => !(item.caseId === caseIdValue && deleteIds.includes(item.tagId)),
      );
      const existing = new Set(
        withoutDeleted.filter((item) => item.caseId === caseIdValue).map((item) => item.tagId),
      );
      const appended = createIds
        .filter((tagId) => !existing.has(tagId))
        .map((tagId) => ({ caseId: caseIdValue, tagId }) as CaseTagItem);
      return [...withoutDeleted, ...appended];
    });

    setInitialTagIds([...draft]);
    return true;
  };

  const saveCasePhases = async (caseIdValue: string) => {
    const initial = new Set(initialPhaseIds);
    const draft = new Set(phaseDraftIds);
    const createIds = [...draft].filter((phaseId) => !initial.has(phaseId));
    const deleteIds = [...initial].filter((phaseId) => !draft.has(phaseId));

    if (!createIds.length && !deleteIds.length) {
      return false;
    }

    for (const phaseId of createIds) {
      const result = await client.models.CasePhase.create(
        { caseId: caseIdValue, phaseId },
        { authMode: "userPool" },
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0]?.message ?? "Failed to create case phase");
      }
    }

    for (const phaseId of deleteIds) {
      const result = await client.models.CasePhase.delete(
        { caseId: caseIdValue, phaseId },
        { authMode: "userPool" },
      );
      if (result.errors?.length) {
        throw new Error(result.errors[0]?.message ?? "Failed to delete case phase");
      }
    }

    setCasePhases((current) => {
      const withoutDeleted = current.filter(
        (item) => !(item.caseId === caseIdValue && deleteIds.includes(item.phaseId)),
      );
      const existing = new Set(
        withoutDeleted
          .filter((item) => item.caseId === caseIdValue)
          .map((item) => item.phaseId),
      );
      const appended = createIds
        .filter((phaseId) => !existing.has(phaseId))
        .map((phaseId) => ({ caseId: caseIdValue, phaseId }) as CasePhaseItem);
      return [...withoutDeleted, ...appended];
    });

    setInitialPhaseIds([...draft]);
    return true;
  };

  const handleEditOpinion = () => {
    setOpinionDraft(opinionText);
    setTagDraftIds(initialTagIds);
    setIsEditingOpinion(true);
  };

  const handleCancelEditOpinion = () => {
    setOpinionDraft(opinionText);
    setTagDraftIds(initialTagIds);
    setIsEditingOpinion(false);
  };

  const handleSaveOpinion = async () => {
    if (!caseItem) return;
    const opinionChanged = opinionDraft !== opinionText;
    const tagsChanged =
      canEditCaseTags &&
      (tagDraftIds.length !== initialTagIds.length ||
        tagDraftIds.some((tagId) => !initialTagIds.includes(tagId)));

    if (!opinionChanged && !tagsChanged) {
      setIsEditingOpinion(false);
      return;
    }

    try {
      setIsSavingOpinion(true);
      if (opinionChanged) {
        const key = loadedOpinionKey || buildOpinionStorageKey(caseItem.opinionUrl, caseItem);
        if (!key) {
          message.error("Opinion file key is missing.");
          return;
        }
        const result = await client.mutations.saveOpinionText(
          {
            key,
            markdown: opinionDraft,
          },
          { authMode: "userPool" },
        );
        if (result.errors?.length) {
          throw new Error(result.errors[0]?.message ?? "Failed to save opinion text");
        }
        setOpinionText(opinionDraft);
        setOpinionSavedAt(new Date().toLocaleTimeString());
      }

      if (tagsChanged) {
        await saveCaseTags(caseItem.caseId);
      }

      setIsEditingOpinion(false);
      message.success("Saved.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSavingOpinion(false);
    }
  };

  const handleOpinionSelectionChange = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    opinionEditorRef.current = target;
    setOpinionSelection({
      start: target.selectionStart ?? 0,
      end: target.selectionEnd ?? 0,
    });
  };

  const wrapOpinionSelection = (marker: string) => {
    const editor = opinionEditorRef.current;
    const length = opinionDraft.length;
    const start = Math.max(0, Math.min(opinionSelection.start, length));
    const end = Math.max(0, Math.min(opinionSelection.end, length));
    const left = opinionDraft.slice(0, start);
    const middle = opinionDraft.slice(start, end);
    const right = opinionDraft.slice(end);
    const wrapped = `${left}${marker}${middle}${marker}${right}`;
    const nextStart = start + marker.length;
    const nextEnd = end + marker.length;

    setOpinionDraft(wrapped);
    setOpinionSelection({ start: nextStart, end: nextEnd });

    window.requestAnimationFrame(() => {
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(nextStart, nextEnd);
    });
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
      await saveCasePhases(caseItem.caseId);
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
      {phasesError ? <Alert type="error" message={phasesError} showIcon /> : null}
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
              <>
                {isWideLayout ? (
                  <div className="case-detail__editor-bar">
                    {isEditingOpinion ? (
                      <div className="case-detail__editor-actions">
                        <div className="case-detail__editor-actions-left">
                          <Button onClick={handleCancelEditOpinion} disabled={isSavingOpinion}>
                            Cancel
                          </Button>
                          <Button
                            type="primary"
                            onClick={handleSaveOpinion}
                            loading={isSavingOpinion}
                          >
                            Save
                          </Button>
                        </div>
                        {canEditCaseTags ? (
                          <Select
                            mode="multiple"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={tagDraftIds}
                            onChange={(values) => setTagDraftIds(values)}
                            options={sortedTagOptions}
                            placeholder="Select case tags"
                            disabled={isSavingOpinion}
                            className="case-detail__editor-tags-select"
                          />
                        ) : null}
                        <Button
                          onClick={() => wrapOpinionSelection("**")}
                          disabled={isSavingOpinion}
                          className="case-detail__editor-actions-bold"
                        >
                          Bold
                        </Button>
                        <Button
                          onClick={() => wrapOpinionSelection("*")}
                          disabled={isSavingOpinion}
                          className="case-detail__editor-actions-italics"
                        >
                          Italics
                        </Button>
                        <Button
                          onClick={() => wrapOpinionSelection("***")}
                          disabled={isSavingOpinion}
                          className="case-detail__editor-actions-both"
                        >
                          Both
                        </Button>
                      </div>
                    ) : (
                      <div className="case-detail__editor-actions">
                        <Button type="primary" onClick={handleEditOpinion}>
                          Edit Opinion
                        </Button>
                        {opinionJsonText ? (
                          <Button onClick={() => setShowJsonInspector((current) => !current)}>
                            {showJsonInspector ? "Hide JSON" : "Inspect JSON"}
                          </Button>
                        ) : null}
                        <div className="case-detail__editor-tags-chips">
                          {initialTagIds.map((tagId) => {
                            const tag = tagsById.get(tagId);
                            const label = tag?.label ?? "Untitled";
                            const background = tag?.color ?? undefined;
                            return (
                              <AdminTagCapsule
                                key={tagId}
                                label={label}
                                background={background}
                                color={getReadableTextColor(background)}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {opinionSavedAt ? (
                      <span className="case-detail__editor-status">Saved at {opinionSavedAt}</span>
                    ) : null}
                  </div>
                ) : null}
                {isEditingOpinion && isWideLayout ? (
                  <div className="case-detail__editor">
                    <Input.TextArea
                      value={opinionDraft}
                      onChange={(event) => setOpinionDraft(event.target.value)}
                      onSelect={handleOpinionSelectionChange}
                      onClick={handleOpinionSelectionChange}
                      onKeyUp={handleOpinionSelectionChange}
                      autoSize={{ minRows: 14, maxRows: 30 }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="case-detail__opinion-content">
                      <ReactMarkdown>{renderedOpinionText}</ReactMarkdown>
                    </div>
                    {showJsonInspector && opinionJsonText ? (
                      <section className="case-detail__json-inspector">
                        <div className="case-detail__json-inspector-header">
                          <h3 className="case-detail__json-inspector-title">Stanbook JSON</h3>
                          {opinionJsonSourceUrl ? (
                            <span className="case-detail__json-inspector-source">
                              {opinionJsonSourceUrl}
                            </span>
                          ) : null}
                        </div>
                        <pre className="case-detail__json-inspector-pre">
                          <code>{opinionJsonText}</code>
                        </pre>
                      </section>
                    ) : null}
                  </>
                )}
              </>
            ) : opinionPdfUrl ? (
              <div className="case-detail__pdf-viewer">
                <div className="case-detail__pdf-header">
                  <h1 className="case-detail__pdf-title">
                    {caseItem?.caseName?.trim() || "Untitled Case"}
                  </h1>
                  <p className="case-detail__pdf-meta">{formatCaseCitationLine(caseItem)}</p>
                  <p className="case-detail__pdf-court">
                    {getCourtLongLabel(caseItem?.court, courtsById)}
                  </p>
                </div>
                <div className="case-detail__pdf-actions">
                  <a
                    className="case-detail__pdf-link"
                    href={opinionPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View PDF
                  </a>
                </div>
                <div className="case-detail__pdf-frame-wrap">
                  <iframe
                    title="Opinion PDF"
                    src={opinionPdfUrl}
                    className="case-detail__pdf-frame"
                  />
                </div>
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
                    options={courts.map((court) => ({
                      value: court.id,
                      label: court.label_short,
                    }))}
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
                <div className="case-metadata-panel__field">
                  <label htmlFor="case-meta-phases">Case Phases</label>
                  <Select
                    id="case-meta-phases"
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    value={phaseDraftIds}
                    disabled={!isEditingMetadata || isSavingMetadata}
                    onChange={(values) => setPhaseDraftIds(values)}
                    options={sortedPhaseOptions}
                    placeholder="Select case phases"
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
