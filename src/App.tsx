import { useEffect, useMemo, useState } from "react";
import { useAuthenticator } from '@aws-amplify/ui-react';
import { Alert, Button, Pagination, Space, Table, Typography } from "antd";
import { LogoutOutlined } from "@ant-design/icons";

function App() {
  const [cases, setCases] = useState<Array<{ file: string; caseName: string }>>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { user, signOut } = useAuthenticator();

  useEffect(() => {
    let active = true;
    async function loadIndex() {
      try {
        const res = await fetch("/texts/index.json");
        if (!res.ok) {
          throw new Error(`Failed to load index (${res.status})`);
        }
        const data = (await res.json()) as {
          items?: Array<{ file: string; caseName: string }>;
          files?: string[];
        };
        if (active) {
          if (Array.isArray(data.items)) {
            setCases(data.items);
          } else if (Array.isArray(data.files)) {
            setCases(data.files.map((file) => ({ file, caseName: file })));
          } else {
            setCases([]);
          }
          setFilesError(null);
        }
      } catch (err) {
        if (active) {
          setFilesError(err instanceof Error ? err.message : "Failed to load index");
        }
      } finally {
        if (active) setFilesLoading(false);
      }
    }

    loadIndex();
    return () => {
      active = false;
    };
  }, []);

  const fileRows = useMemo(
    () => cases.map((item) => ({ key: item.file, name: item.caseName })),
    [cases]
  );

  const pageSize = 100;
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return fileRows.slice(start, start + pageSize);
  }, [fileRows, currentPage]);

  return (
    <main>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Space align="center" style={{ justifyContent: "space-between", width: "100%" }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Text Files
          </Typography.Title>
          <Button icon={<LogoutOutlined />} onClick={signOut}>
            Sign out
          </Button>
        </Space>

        {filesError ? (
          <Alert type="error" message="Index load failed" description={filesError} />
        ) : null}
        <div className="table-shell">
          <Table
            columns={[{ title: "Filename", dataIndex: "name" }]}
            dataSource={pagedRows}
            loading={filesLoading}
            pagination={false}
            size="middle"
          />
        </div>
        <div className="pagination-bar">
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={fileRows.length}
            showSizeChanger={false}
            onChange={setCurrentPage}
          />
        </div>

      </Space>
    </main>
  );
}

export default App;
