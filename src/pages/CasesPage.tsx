import { useEffect, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Alert, Space, Table, Typography } from "antd";

const client = generateClient<Schema>();

type CaseRow = Schema["Case"]["type"];

export default function CasesPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);

  async function createDummyCase() {
    try {
      const caseName = window.prompt("Case name?");
      if (!caseName) {
        return;
      }
      setFilesLoading(true);
      const now = new Date();
      const id = `dummy_${now.getTime()}`;
      const { data: created } = await client.models.Case.create({
        caseId: id,
        caseName,
        opinionUrl: "https://example.com",
        court: "NY Court of Appeals",
        decisionDate: now.toISOString().slice(0, 10),
        citation: "1 NY3d 1",
        summary: "Dummy summary",
      });
      const { data } = await client.models.Case.list({ limit: 5000 });
      let nextCases = data ?? [];
      if (created?.caseId && !nextCases.some((item) => item.caseId === created.caseId)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const retry = await client.models.Case.list({ limit: 5000 });
        nextCases = retry.data ?? nextCases;
      }
      setCases(nextCases);
      setFilesError(null);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setFilesLoading(false);
    }
  }

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
      <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Text Files
        </Typography.Title>
        <button onClick={createDummyCase}>New</button>
      </Space>

      {filesError ? (
        <Alert type="error" message="Index load failed" description={filesError} />
      ) : null}

      <div className="table-shell">
        <Table
          columns={[
            {
              title: "Case name",
              dataIndex: "caseName",
              render: (value, record) =>
                record.opinionUrl ? (
                  <a href={record.opinionUrl} target="_blank" rel="noreferrer">
                    {value}
                  </a>
                ) : (
                  value
                ),
            },
          ]}
          dataSource={cases}
          loading={filesLoading}
          pagination={false}
          size="middle"
          rowKey="caseId"
        />
      </div>
    </Space>
  );
}
