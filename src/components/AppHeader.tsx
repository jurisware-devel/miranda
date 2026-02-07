import React from "react";
import { Button, Layout } from "antd";
import { NavLink } from "react-router-dom";
import CaseFilters from "./CaseFilters";
import UserMenu from "./UserMenu";

const { Header } = Layout;

type Option = { value: string; label: string };

type AppHeaderProps = {
  showFilters: boolean;
  isMobile: boolean;
  onToggleFilters: () => void;
  authorOptions: Option[];
  selectedAuthor: string | null;
  onAuthorChange: (value: string | null) => void;
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
  isMobile,
  onToggleFilters,
  authorOptions,
  selectedAuthor,
  onAuthorChange,
  nameQuery,
  onNameQueryChange,
  sortOrder,
  onSortOrderChange,
  userLabel,
  onAccount,
  onSignOut,
}) => {
  return (
    <Header className="app-header">
      <div className="app-header-brand">
        <div className="app-header-title">Miranda</div>
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
      {!showFilters ? null : isMobile ? (
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
            selectedAuthor={selectedAuthor}
            onAuthorChange={onAuthorChange}
            nameQuery={nameQuery}
            onNameQueryChange={onNameQueryChange}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            wrapClassName="app-header-filter"
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
