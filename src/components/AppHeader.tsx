import React from "react";
import { Button, Dropdown, Layout } from "antd";
import { useNavigate } from "react-router-dom";
import CaseFilters from "./CaseFilters";
import UserMenu from "./UserMenu";

const { Header } = Layout;

type Option = { value: string; label: string };

type AppHeaderProps = {
  basePath?: string;
  showUserMenu?: boolean;
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
  onAccount?: () => void;
  onSignOut?: () => void;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  basePath = "",
  showUserMenu = false,
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
  onAccount,
  onSignOut,
}) => {
  const navigate = useNavigate();
  const rootPath = basePath || "/";
  const tagsPath = basePath ? `${basePath}/tags` : "/tags";
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
              navigate(key === "tags" ? tagsPath : rootPath);
            },
          }}
        >
          <button type="button" className="app-header-logo-button" aria-label="Open menu">
            <img
              className="app-header-logo"
              src="/miranda-logotype.svg"
              alt="Miranda"
            />
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
      {showUserMenu && onAccount && onSignOut ? (
        <div className="app-header-user-wrap">
          <UserMenu onAccount={onAccount} onSignOut={onSignOut} />
        </div>
      ) : null}
    </Header>
  );
};

export default AppHeader;
