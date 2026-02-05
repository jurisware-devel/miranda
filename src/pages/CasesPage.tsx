import { useEffect, useMemo, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Alert, Pagination, Space, Table, Typography } from "antd";

const client = generateClient<Schema>();
const pageSize = 100;

type CaseRow = Schema["Case"]["type"];

export default function CasesPage() {
  const [pages, setPages] = useState<Record<number, CaseRow[]>>({});
  const [pageTokens, setPageTokens] = useState<Record<number, string | null>>({
    1: null,
  });
  const [hasMorePages, setHasMorePages] = useState<Record<number, boolean>>({});
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  async function loadPage(page: number) {
    if (pages[page] || filesLoading) {
      return;
    }
    const token = pageTokens[page];
    if (token === undefined) {
      return;
    }

    setFilesLoading(true);
    try {
      const { data, nextToken } = await client.models.Case.list({
        limit: pageSize,
        nextToken: token ?? undefined,
      });
      setPages((prev) => ({ ...prev, [page]: data ?? [] }));
      setPageTokens((prev) => ({
        ...prev,
        [page + 1]: nextToken ?? null,
      }));
      setHasMorePages((prev) => ({ ...prev, [page]: Boolean(nextToken) }));
      setFilesError(null);
    } catch (err) {
      setFilesError(err instanceof Error ? err.message : "Failed to load cases");
    } finally {
      setFilesLoading(false);
    }
  }

  useEffect(() => {
    void loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pages[currentPage]) {
      void loadPage(currentPage);
    }
  }, [currentPage, pages]);

  const pagedRows = useMemo(() => pages[currentPage] ?? [], [pages, currentPage]);
  const hasMore = hasMorePages[currentPage] ?? false;
  const totalForPagination = hasMore
    ? currentPage * pageSize + 1
    : (currentPage - 1) * pageSize + pagedRows.length;

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
          dataSource={pagedRows}
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
          total={totalForPagination}
          showSizeChanger={false}
          onChange={setCurrentPage}
        />
      </div>
    </Space>
  );
}
