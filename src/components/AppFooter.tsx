import React from "react";
import { Layout, Pagination } from "antd";

const { Footer } = Layout;

type AppFooterProps = {
  showPagination: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

const AppFooter: React.FC<AppFooterProps> = ({
  showPagination,
  currentPage,
  pageSize,
  total,
  onPageChange,
}) => {
  return (
    <Footer className="app-footer">
      {showPagination ? (
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={total}
          showSizeChanger={false}
          onChange={(page) => onPageChange(page)}
        />
      ) : null}
    </Footer>
  );
};

export default AppFooter;
