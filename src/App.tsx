import React, { useEffect, useMemo, useState } from "react";
import { Alert, Card, Layout, Masonry, Select, Spin } from "antd";
import { generateClient } from "aws-amplify/data";

const { Header, Footer, Content } = Layout;

const client = generateClient();

type CaseItem = {
  caseId?: string;
  caseName?: string;
  citation?: string;
  decisionDate?: string;
  court?: string;
  opinionUrl?: string;
  slipOp?: string;
  ny3dCite?: string;
  summaryText?: string;
};

const App: React.FC = () => {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null);

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

  const filteredCases = useMemo(() => {
    if (!selectedAuthor) return sortedCases;
    return sortedCases.filter((item) => item.authoringJudge === selectedAuthor);
  }, [sortedCases, selectedAuthor]);

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
              items={summaries}
              itemRender={(item, index) => {
                const href = item.opinionUrl
                  ? item.opinionUrl.startsWith("http")
                    ? item.opinionUrl
                    : `https://miranda.jurisware.com/texts/${item.opinionUrl}`
                  : "";
                const title = item.caseName ?? `Case ${index + 1}`;
                const cite = item.ny3dCite || item.slipOp || item.citation || "—";
                const decision = item.decisionDate
                  ? new Date(item.decisionDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—";
                const citeLine = `${cite} (${decision})`;
                return (
                  <Card key={item.caseId ?? index} className="grid-card" size="small">
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
                      {item.authoringJudge || "Memorandum"}
                    </div>
                    <div className="grid-card__summary">{item.summaryText}</div>
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
