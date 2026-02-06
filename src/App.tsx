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

type CaseItem = Schema["Case"]["type"] & { summaryText?: string };

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
  editable?: boolean;
  onCaseUpdated?: (updated: CaseItem) => void;
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

const normalizeDate = (value?: string | null) => value ?? "";
const normalizeNullableField = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const CaseDetail: React.FC<CaseDetailProps> = ({
  cases,
  loading,
  error,
  editable = false,
  onCaseUpdated,
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
    });
  };

  useEffect(() => {
    if (!caseItem) return;
    resetFormState(caseItem);
  }, [caseItem]);

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
      };
      const result = await client.models.Case.update(payload);
      const updated = (result?.data ?? null) as CaseItem | null;
      setCaseItem(updated);
      if (updated && onCaseUpdated) {
        onCaseUpdated(updated);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const summaries = useMemo(() => {
    const words = [
      "lorem",
      "ipsum",
      "dolor",
      "sit",
      "amet",
      "consectetur",
      "adipiscing",
      "elit",
      "sed",
      "do",
      "eiusmod",
      "tempor",
      "incididunt",
      "ut",
      "labore",
      "et",
      "dolore",
      "magna",
      "aliqua",
      "ut",
      "enim",
      "ad",
      "minim",
      "veniam",
      "quis",
      "nostrud",
      "exercitation",
      "ullamco",
      "laboris",
      "nisi",
      "ut",
      "aliquip",
      "ex",
      "ea",
      "commodo",
      "consequat",
    ];

    function makeSummary(seed: number) {
      let count = (seed % 141) + 10; // 10-150
      const result = [];
      let idx = seed % words.length;
      while (count > 0) {
        result.push(words[idx % words.length]);
        idx += 7;
        count -= 1;
      }
      return result.join(" ");
    }

    return filteredCases.map((item, index) => ({
      ...item,
      summaryText: makeSummary(index + 1),
    }));
  }, [filteredCases]);

  const pagedSummaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return summaries.slice(start, start + pageSize);
  }, [summaries, currentPage, pageSize]);

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

  const navigate = useNavigate();
  const handleCaseUpdated = (updated: CaseItem) => {
    setCases((prev) =>
      prev.map((item) => (item.caseId === updated.caseId ? updated : item)),
    );
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
                          <div className="grid-card__summary">
                            {renderReviewField(data.summaryText, "—", handleReviewClick)}
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
                onCaseUpdated={handleCaseUpdated}
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
                editable
                onCaseUpdated={handleCaseUpdated}
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
              total={summaries.length}
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
