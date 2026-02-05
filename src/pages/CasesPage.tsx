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
      <Typography.Title level={2} style={{ margin: 0 }}>
        Text Files
      </Typography.Title>

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
