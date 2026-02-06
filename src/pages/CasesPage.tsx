import { useEffect, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Alert, Card, Pagination, Space } from "antd";

const client = generateClient<Schema>();

type CaseRow = Schema["Case"]["type"];

export default function CasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    let active = true;
    async function loadCases() {
      try {
        const { data } = await client.models.Case.list({ limit: 5000 });
        if (!active) return;
        setCases(data ?? []);
        setFilesError(null);
      } catch (err) {
        if (active) {
          setFilesError(err instanceof Error ? err.message : "Failed to load cases");
        }
      } finally {
        if (active) setFilesLoading(false);
      }
    }

    void loadCases();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div className="table-card">
        <div className="app-card-grid">
          {filesError ? (
            <Alert type="error" message="Index load failed" description={filesError} />
          ) : null}
          <div className="card-scroll">
            {cases
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((record) => {
                const href = record.opinionUrl
                  ? record.opinionUrl.startsWith("http")
                    ? record.opinionUrl
                    : `https://miranda.jurisware.com/texts/${record.opinionUrl}`
                  : "";
                const title = href ? (
                  <a href={href} target="_blank" rel="noreferrer">
                    {record.caseName}
                  </a>
                ) : (
                  record.caseName
                );
                return (
                  <Card
                    key={record.caseId}
                    className="case-card"
                    title={title}
                    size="small"
                  >
                    <div className="case-card__meta">
                      {record.citation || record.slipOp || record.ny3dCite || "—"}
                    </div>
                    <div className="case-card__row">
                      <span>Decision</span>
                      <span>{record.decisionDate || "—"}</span>
                    </div>
                    <div className="case-card__row">
                      <span>Court</span>
                      <span>{record.court || "—"}</span>
                    </div>
                    <div className="case-card__row">
                      <span>Judge</span>
                      <span>{record.authoringJudge || "—"}</span>
                    </div>
                    {record.summary ? (
                      <div className="case-card__summary">{record.summary}</div>
                    ) : null}
                  </Card>
                );
              })}
          </div>
        </div>
        <div className="cases-footer">
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={cases.length}
            showSizeChanger={false}
            onChange={setCurrentPage}
          />
        </div>
      </div>

    </Space>
  );
}
