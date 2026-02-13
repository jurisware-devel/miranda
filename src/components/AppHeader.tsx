import React from "react";
import { Button, Dropdown, Layout } from "antd";
import { useNavigate } from "react-router-dom";
import CaseFilters from "./CaseFilters";

const { Header } = Layout;

type Option = { value: string; label: string };

type AppHeaderProps = {
  showFilters: boolean;
  lockFilters?: boolean;
  isMobile: boolean;
  onToggleFilters: () => void;
  authorOptions: Option[];
  tagOptions: Option[];
  selectedAuthor: string | null;
  onAuthorChange: (value: string | null) => void;
  selectedTagIds: string[];
  onTagChange: (value: string[]) => void;
  nameQuery: string;
  onNameQueryChange: (value: string) => void;
  sortOrder: string;
  onSortOrderChange: (value: string) => void;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  showFilters,
  lockFilters = false,
  isMobile,
  onToggleFilters,
  authorOptions,
  tagOptions,
  selectedAuthor,
  onAuthorChange,
  selectedTagIds,
  onTagChange,
  nameQuery,
  onNameQueryChange,
  sortOrder,
  onSortOrderChange,
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
      {!showFilters ? null : isMobile && !lockFilters ? (
        <Button
          type="text"
          className="app-header-filter-toggle"
          onClick={onToggleFilters}
        >
          Filters
        </Button>
      ) : (
        <div className="app-header-filters">
          <CaseFilters
            authorOptions={authorOptions}
            tagOptions={tagOptions}
            selectedAuthor={selectedAuthor}
            onAuthorChange={onAuthorChange}
            selectedTagIds={selectedTagIds}
            onTagChange={onTagChange}
            nameQuery={nameQuery}
            onNameQueryChange={onNameQueryChange}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            wrapClassName="app-header-filter"
            disabled={lockFilters}
          />
        </div>
      )}
    </Header>
  );
};

export default AppHeader;
