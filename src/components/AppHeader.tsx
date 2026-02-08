import React from "react";
import { Button, Layout } from "antd";
import { NavLink, useNavigate } from "react-router-dom";
import CaseFilters from "./CaseFilters";
import UserMenu from "./UserMenu";

const { Header } = Layout;

type Option = { value: string; label: string };

type AppHeaderProps = {
  showFilters: boolean;
  lockFilters?: boolean;
  isMobile: boolean;
  onToggleFilters: () => void;
  onClearFilters: () => void;
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
  userLabel: string;
  onAccount: () => void;
  onSignOut: () => void;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  showFilters,
  lockFilters = false,
  isMobile,
  onToggleFilters,
  onClearFilters,
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
  userLabel,
  onAccount,
  onSignOut,
}) => {
  const navigate = useNavigate();
  return (
    <Header className="app-header">
      <div className="app-header-brand">
        <button
          type="button"
          className="app-header-logo-button"
          onClick={() => {
            onClearFilters();
            navigate("/");
          }}
          aria-label="Go to cases"
        >
          <img className="app-header-logo" src="/miranda-logotype.svg" alt="Miranda" />
        </button>
        <nav className="app-header-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `app-header-link${isActive ? " app-header-link--active" : ""}`
            }
          >
            Cases
          </NavLink>
          <NavLink
            to="/tags"
            className={({ isActive }) =>
              `app-header-link${isActive ? " app-header-link--active" : ""}`
            }
          >
            Tags
          </NavLink>
        </nav>
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
      <div className="app-header-user-wrap">
        <UserMenu label={userLabel} onAccount={onAccount} onSignOut={onSignOut} />
      </div>
    </Header>
  );
};

export default AppHeader;
