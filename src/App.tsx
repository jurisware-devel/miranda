import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Grid,
  Input,
  Layout,
  Masonry,
  Pagination,
  Select,
  Switch,
  Spin,
} from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import { generateClient } from "aws-amplify/data";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import type { Schema } from "../amplify/data/resource";
import TagsPage from "./pages/TagsPage";

const { Header, Footer, Content } = Layout;

const client = generateClient<Schema>();

type CaseItem = Schema["Case"]["type"];
type TagItem = Schema["Tag"]["type"];
type CaseTagItem = Schema["CaseTag"]["type"];

const buildOpinionUrl = (opinionUrl?: string) => {
  if (!opinionUrl) return "";
  if (opinionUrl.startsWith("http")) return opinionUrl;
  const trimmed = opinionUrl.replace(/^\//, "");
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://miranda.jurisware.com";
  return `${origin}/texts/${trimmed}`;
};

const REVIEW_MARKER = "_REVIEW_";

const renderReviewField = (
  value: string | undefined,
  fallback = "—",
  onReviewClick?: () => void,
) => {
  if (!value) return fallback;
  if (value.includes(REVIEW_MARKER)) {
    return (
      <button
        type="button"
        className="badge badge--review badge--review-button"
        onClick={onReviewClick}
      >
        Review
      </button>
    );
  }
  return value;
};

type CaseDetailProps = {
  cases: CaseItem[];
  loading: boolean;
  error: string | null;
  tags: TagItem[];
  caseTags: CaseTagItem[];
  editable?: boolean;
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

const normalizeDate = (value?: string | null) => value ?? "";
const normalizeNullableField = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const CaseDetail: React.FC<CaseDetailProps> = ({
  cases,
  loading,
  error,
  tags,
  caseTags,
  editable = false,
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
  const [isEditing, setIsEditing] = useState(editable);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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
      .map((item) => item.tagId);
    setSelectedTagIds(nextTagIds);
  }, [caseItem, caseTags]);

  useEffect(() => {
    setIsEditing(editable);
  }, [editable]);

  const handleSave = async () => {
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
      setCaseItem(updated);
      if (updated && onCaseUpdated) {
        onCaseUpdated(updated);
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
    setIsEditing(false);
  };

  const title = caseItem?.caseName ?? caseId ?? "Case";
  const cite = caseItem?.ny3dCite || caseItem?.slipOp || caseItem?.citation || "—";
  const decision = caseItem?.decisionDate
    ? new Date(caseItem.decisionDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const citeLine = `${cite} (${decision})`;

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
          <div className="case-detail__title-row">
            <div className="case-detail__title">{title}</div>
            <Button
              className="case-detail__edit"
              type="text"
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
            />
          </div>
          <div className="case-detail__meta">{citeLine}</div>
          <div className="case-detail__author">
            {caseItem.authoringJudge || "Memorandum"}
          </div>
          {isEditing ? (
            <div className="case-detail__form">
              <div className="case-detail__form-row">
                <label>Case Name</label>
                <Input
                  value={formState.caseName}
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
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      court: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="case-detail__form-row">
                <label>Decision Date</label>
                <Input
                  type="date"
                  value={formState.decisionDate}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      decisionDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="case-detail__form-row">
                <label>Argued Date</label>
                <Input
                  type="date"
                  value={formState.arguedDate}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      arguedDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="case-detail__form-row">
                <label>Corrected Date</label>
                <Input
                  type="date"
                  value={formState.correctedDate}
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
                  checked={formState.ai_review}
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
                  onChange={(value) => setSelectedTagIds(value as string[])}
                  options={tags.map((tag) => ({
                    value: tag.tagId,
                    label: tag.label ?? "Untitled",
                  }))}
                />
              </div>
              <div className="case-detail__form-row case-detail__form-row--full">
                <label>Caption</label>
                <Input.TextArea
                  rows={2}
                  value={formState.partiesCaption}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      partiesCaption: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="case-detail__form-actions">
                <Button onClick={handleCancelEdit}>Cancel</Button>
                <Button
                  type="primary"
                  loading={saveLoading}
                  onClick={async () => {
                    const saved = await handleSave();
                    if (saved) {
                      setIsEditing(false);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : null}
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
        </div>
      ) : (
        <Alert type="warning" message="Case not found" showIcon />
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [caseTags, setCaseTags] = useState<CaseTagItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [caseTagsError, setCaseTagsError] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.sm;
  const location = useLocation();
  const isCaseView = location.pathname.startsWith("/case/");
  const isCasesPage = location.pathname === "/";
  const showFilters = isCasesPage && !isCaseView;

  const tagsById = useMemo(() => {
    return new Map(tags.map((tag) => [tag.tagId, tag.label ?? ""]));
  }, [tags]);

  const caseTagsByCaseId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of caseTags) {
      if (!map.has(item.caseId)) {
        map.set(item.caseId, []);
      }
      map.get(item.caseId)?.push(item.tagId);
    }
    return map;
  }, [caseTags]);

  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      const aDate = a.decisionDate ? Date.parse(a.decisionDate) : 0;
      const bDate = b.decisionDate ? Date.parse(b.decisionDate) : 0;
      return bDate - aDate;
    });
  }, [cases]);

  const authorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of cases) {
      if (item.authoringJudge) set.add(item.authoringJudge);
    }
    const options = Array.from(set)
      .sort()
      .map((value) => ({ value, label: value }));
    return [{ value: "Memorandum", label: "Memorandum" }, ...options];
  }, [cases]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedNameQuery(nameQuery);
    }, 300);
    return () => clearTimeout(handle);
  }, [nameQuery]);

  const filteredCases = useMemo(() => {
    const query = debouncedNameQuery.trim().toLowerCase();
    return sortedCases.filter((item) => {
      if (selectedAuthor && item.authoringJudge !== selectedAuthor) {
        return false;
      }
      if (!query) return true;
      return (item.caseName ?? "").toLowerCase().includes(query);
    });
  }, [sortedCases, selectedAuthor, debouncedNameQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedAuthor, debouncedNameQuery]);

  const pagedSummaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  const masonryItems = useMemo(
    () =>
      pagedSummaries.map((item) => ({
        key: item.caseId,
        data: item,
      })),
    [pagedSummaries],
  );

  useEffect(() => {
    let active = true;
    async function loadCases() {
      try {
        const { data } = await client.models.Case.list({ limit: 5000 });
        if (!active) return;
        setCases((data ?? []) as CaseItem[]);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load cases");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadCases();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadTagsAndLinks() {
      try {
        const [{ data: tagData }, { data: linkData }] = await Promise.all([
          client.models.Tag.list({ limit: 5000 }),
          client.models.CaseTag.list({ limit: 5000 }),
        ]);
        if (!active) return;
        setTags(tagData ?? []);
        setCaseTags(linkData ?? []);
        setTagsError(null);
        setCaseTagsError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load tags";
        setTagsError(message);
        setCaseTagsError(message);
      }
    }

    void loadTagsAndLinks();
    return () => {
      active = false;
    };
  }, []);

  const navigate = useNavigate();
  const handleCaseUpdated = (updated: CaseItem) => {
    setCases((prev) =>
      prev.map((item) => (item.caseId === updated.caseId ? updated : item)),
    );
  };
  const handleCaseTagsUpdated = (_caseId: string, nextCaseTags: CaseTagItem[]) => {
    setCaseTags(nextCaseTags);
  };

  return (
    <Layout className="app-shell" style={{ background: "transparent" }}>
      <Header className="app-header">
        <div className="app-header-brand">
          <div className="app-header-title">Miranda</div>
          <nav className="app-header-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `app-header-link${isActive ? " app-header-link--active" : ""}`
              }
            >
              Cases
            </NavLink>
            <NavLink
              to="/tags"
              className={({ isActive }) =>
                `app-header-link${isActive ? " app-header-link--active" : ""}`
              }
            >
              Tags
            </NavLink>
          </nav>
        </div>
        {!showFilters ? null : isMobile ? (
          <Button
            type="text"
            className="app-header-filter-toggle"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            Filters
          </Button>
        ) : (
          <div className="app-header-filters">
            <div className="app-header-filter">
              <Select
                allowClear
                placeholder="Author"
                options={authorOptions}
                value={selectedAuthor ?? undefined}
                onChange={(value) => setSelectedAuthor(value ?? null)}
                style={{ minWidth: 200 }}
              />
            </div>
            <div className="app-header-filter">
              <Input
                placeholder="Search case name"
                value={nameQuery}
                allowClear
                onChange={(event) => setNameQuery(event.target.value)}
                style={{ minWidth: 240 }}
              />
            </div>
          </div>
        )}
      </Header>
      <Content className="app-content">
        <Routes>
          <Route
            path="/"
            element={
              <div className="masonry-wrap">
                {isMobile && filtersOpen ? (
                  <div className="filter-panel">
                    <Select
                      allowClear
                      placeholder="Author"
                      options={authorOptions}
                      value={selectedAuthor ?? undefined}
                      onChange={(value) => setSelectedAuthor(value ?? null)}
                    />
                    <Input
                      placeholder="Search case name"
                      value={nameQuery}
                      allowClear
                      onChange={(event) => setNameQuery(event.target.value)}
                    />
                  </div>
                ) : null}
                {error ? <Alert type="error" message={error} showIcon /> : null}
                {tagsError ? <Alert type="error" message={tagsError} showIcon /> : null}
                {caseTagsError ? (
                  <Alert type="error" message={caseTagsError} showIcon />
                ) : null}
                {loading ? (
                  <div className="card-grid__loading">
                    <Spin />
                  </div>
                ) : (
                  <Masonry
                    columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
                    gutter={{ xs: 8, sm: 12, md: 16 }}
                    items={masonryItems}
                    itemRender={({ data, index }) => {
                      const title = data.caseName ?? `Case ${index + 1}`;
                      const cite =
                        data.ny3dCite || data.slipOp || data.citation || "—";
                      const decision = data.decisionDate
                        ? new Date(data.decisionDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—";
                      const citeLine = `${cite} (${decision})`;
                      const handleReviewClick = () =>
                        navigate(`/case/${data.caseId}`);
                      const tagLabels =
                        caseTagsByCaseId.get(data.caseId) ?? [];
                      return (
                        <Card key={data.caseId ?? index} className="grid-card" size="small">
                          <div className="grid-card__badge">
                            <span className="badge badge--coa">CoA</span>
                          </div>
                          <div className="grid-card__title">
                            <button
                              type="button"
                              className="grid-card__link"
                              onClick={() => navigate(`/case/${data.caseId}`)}
                            >
                              {renderReviewField(
                                title,
                                `Case ${index + 1}`,
                                handleReviewClick,
                              )}
                            </button>
                          </div>
                          <div className="grid-card__meta">
                            {renderReviewField(citeLine, "—", handleReviewClick)}
                          </div>
                          <div className="grid-card__author">
                            {renderReviewField(
                              data.authoringJudge || "Memorandum",
                              "Memorandum",
                              handleReviewClick,
                            )}
                          </div>
                          <div className="grid-card__tags">
                            {tagLabels.length
                              ? tagLabels.map((tagId) => (
                                  <span key={tagId} className="tag-pill">
                                    {tagsById.get(tagId) ?? "Untitled"}
                                  </span>
                                ))
                              : null}
                          </div>
                          <div className="grid-card__summary">
                            {(data.ai_review ?? true) ? (
                              <div className="grid-card__ai-flag">
                                AI gen - needs review
                              </div>
                            ) : null}
                            {renderReviewField(
                              data.summary ?? undefined,
                              "—",
                              handleReviewClick,
                            )}
                          </div>
                        </Card>
                      );
                    }}
                  />
                )}
              </div>
            }
          />
          <Route
            path="/case/:caseId"
            element={
              <CaseDetail
                cases={cases}
                loading={loading}
                error={error}
                tags={tags}
                caseTags={caseTags}
                onCaseUpdated={handleCaseUpdated}
                onCaseTagsUpdated={handleCaseTagsUpdated}
              />
            }
          />
          <Route
            path="/case/:caseId/edit"
            element={
              <CaseDetail
                cases={cases}
                loading={loading}
                error={error}
                tags={tags}
                caseTags={caseTags}
                editable
                onCaseUpdated={handleCaseUpdated}
                onCaseTagsUpdated={handleCaseTagsUpdated}
              />
            }
          />
          <Route path="/tags" element={<TagsPage />} />
        </Routes>
      </Content>
      <Footer className="app-footer">
        {isCaseView ? null : (
          <div className="pagination-wrap">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredCases.length}
              showSizeChanger={false}
              onChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </Footer>
    </Layout>
  );
};

export default App;
