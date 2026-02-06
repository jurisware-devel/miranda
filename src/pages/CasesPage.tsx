import { useEffect, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Alert, Pagination, Space, Table, Typography } from "antd";

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
      <Typography.Title level={2} style={{ margin: 0 }}>
        Text Files
      </Typography.Title>

      {filesError ? (
        <Alert type="error" message="Index load failed" description={filesError} />
      ) : null}

      <div className="table-shell">
        <Table
          tableLayout="fixed"
          scroll={{ x: "max-content" }}
          columns={[
            {
              title: "Case name",
              dataIndex: "caseName",
              width: 200,
              ellipsis: true,
              render: (value, record) => {
                if (!record.opinionUrl) return value;
                const href = record.opinionUrl.startsWith("http")
                  ? record.opinionUrl
                  : `https://miranda.jurisware.com/texts/${record.opinionUrl}`;
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {value}
                  </a>
                );
              },
            },
            {
              title: "Case ID",
              dataIndex: "caseId",
              width: 140,
              ellipsis: true,
            },
            {
              title: "Slip Op",
              dataIndex: "slipOp",
              width: 160,
              ellipsis: true,
            },
            {
              title: "NY3d Cite",
              dataIndex: "ny3dCite",
              width: 140,
              ellipsis: true,
            },
            {
              title: "Citation",
              dataIndex: "citation",
              width: 180,
              ellipsis: true,
            },
            {
              title: "Decision date",
              dataIndex: "decisionDate",
              width: 140,
              ellipsis: true,
            },
            {
              title: "Argued date",
              dataIndex: "arguedDate",
              width: 140,
              ellipsis: true,
            },
            {
              title: "Corrected date",
              dataIndex: "correctedDate",
              width: 160,
              ellipsis: true,
            },
            {
              title: "Court",
              dataIndex: "court",
              width: 160,
              ellipsis: true,
            },
            {
              title: "Authoring judge",
              dataIndex: "authoringJudge",
              width: 160,
              ellipsis: true,
            },
            {
              title: "Disposition",
              dataIndex: "disposition",
              width: 140,
              ellipsis: true,
            },
            {
              title: "Lower court cite",
              dataIndex: "lowerCourtCite",
              width: 180,
              ellipsis: true,
            },
            {
              title: "Statutes cited",
              dataIndex: "statutesCited",
              width: 220,
              ellipsis: true,
              render: (value) => (Array.isArray(value) ? value.join(", ") : value),
            },
            {
              title: "Parties caption",
              dataIndex: "partiesCaption",
              width: 260,
              ellipsis: true,
            },
            {
              title: "Summary",
              dataIndex: "summary",
              width: 280,
              ellipsis: true,
            },
            {
              title: "Opinion URL",
              dataIndex: "opinionUrl",
              width: 140,
              ellipsis: true,
              render: (value) => {
                if (!value) return "";
                const href = value.startsWith("http")
                  ? value
                  : `https://miranda.jurisware.com/texts/${value}`;
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    Link
                  </a>
                );
              },
            },
          ]}
          dataSource={cases.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          loading={filesLoading}
          pagination={false}
          size="middle"
          rowKey="caseId"
        />
      </div>

      <div className="pagination-bar">
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={cases.length}
          showSizeChanger={false}
          onChange={setCurrentPage}
        />
      </div>
    </Space>
  );
}
