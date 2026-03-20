import React from "react";
import { Layout, Pagination } from "antd";

const { Footer } = Layout;

type AppFooterProps = {
  showPagination: boolean;
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  footerAction?: React.ReactNode;
};

const AppFooter: React.FC<AppFooterProps> = ({
  showPagination,
  currentPage,
  pageSize,
  total,
  onPageChange,
  footerAction,
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
      {footerAction ? <div className="app-footer-action">{footerAction}</div> : null}
    </Footer>
  );
};

export default AppFooter;
