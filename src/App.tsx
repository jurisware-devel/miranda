import React, { useEffect, useMemo, useState } from "react";
import { Alert, Card, Input, Layout, Masonry, Select, Spin } from "antd";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";

const { Header, Footer, Content } = Layout;

const client = generateClient<Schema>();

type CaseItem = Schema["Case"]["type"] & { summaryText?: string };

const App: React.FC = () => {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState("");
  const [debouncedNameQuery, setDebouncedNameQuery] = useState("");

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
      let count = (seed % 61) + 15; // 15-75
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

  const masonryItems = useMemo(
    () =>
      summaries.map((item) => ({
        key: item.caseId,
        data: item,
      })),
    [summaries],
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

  return (
    <Layout className="app-shell" style={{ background: "transparent" }}>
      <Header className="app-header">
        <div className="app-header-title">Miranda</div>
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
      </Header>
      <Content className="app-content">
        <div className="masonry-wrap">
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
                const href = data.opinionUrl
                  ? data.opinionUrl.startsWith("http")
                    ? data.opinionUrl
                    : `https://miranda.jurisware.com/texts/${data.opinionUrl}`
                  : "";
                const title = data.caseName ?? `Case ${index + 1}`;
                const cite = data.ny3dCite || data.slipOp || data.citation || "—";
                const decision = data.decisionDate
                  ? new Date(data.decisionDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";
                const citeLine = `${cite} (${decision})`;
                return (
                  <Card key={data.caseId ?? index} className="grid-card" size="small">
                    <div className="grid-card__badge">
                      <span className="badge badge--coa">CoA</span>
                    </div>
                    <div className="grid-card__title">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          {title}
                        </a>
                      ) : (
                        title
                      )}
                    </div>
                    <div className="grid-card__meta">{citeLine}</div>
                    <div className="grid-card__author">
                      {data.authoringJudge || "Memorandum"}
                    </div>
                    <div className="grid-card__summary">{data.summaryText}</div>
                  </Card>
                );
              }}
            />
          )}
        </div>
      </Content>
      <Footer className="app-footer">Footer</Footer>
    </Layout>
  );
};

export default App;
