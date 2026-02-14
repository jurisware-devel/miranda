import React from "react";
import { Button, Dropdown, Layout } from "antd";
import { useNavigate } from "react-router-dom";
import CaseFilters from "./CaseFilters";
import type { CaseFilterControls } from "../logic/filterControls";

const { Header } = Layout;

type AppHeaderProps = {
  showFilters: boolean;
  lockFilters?: boolean;
  isMobile: boolean;
  onToggleFilters: () => void;
  filters: CaseFilterControls;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  showFilters,
  lockFilters = false,
  isMobile,
  onToggleFilters,
  filters,
}) => {
  const navigate = useNavigate();
  return (
    <Header className="app-header">
      <div className="app-header-brand">
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "cases", label: "Cases" },
              { key: "tags", label: "Tags" },
            ],
            onClick: ({ key }) => {
              navigate(key === "tags" ? "/tags" : "/");
            },
          }}
        >
          <button type="button" className="app-header-logo-button" aria-label="Open menu">
            <img className="app-header-logo" src="/miranda-logotype.svg" alt="Miranda" />
          </button>
        </Dropdown>
      </div>
      {!showFilters ? null : isMobile ? (
        lockFilters ? null : (
          <Button
            type="text"
            className="app-header-filter-toggle"
            onClick={onToggleFilters}
          >
            Filters
          </Button>
        )
      ) : (
        <div className="app-header-filters">
          <CaseFilters
            authorOptions={filters.authorOptions}
            tagOptions={filters.tagOptions}
            selectedAuthor={filters.selectedAuthor}
            onAuthorChange={filters.onAuthorChange}
            selectedTagIds={filters.selectedTagIds}
            onTagChange={filters.onTagChange}
            nameQuery={filters.nameQuery}
            onNameQueryChange={filters.onNameQueryChange}
            sortOrder={filters.sortOrder}
            onSortOrderChange={filters.onSortOrderChange}
            wrapClassName="app-header-filter"
            disabled={lockFilters}
          />
        </div>
      )}
    </Header>
  );
};

export default AppHeader;
