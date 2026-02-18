import React from "react";
import { Button, Layout } from "antd";
import { useNavigate } from "react-router-dom";
import CaseFilters from "./CaseFilters";
import type { CaseFilterControls } from "../logic/filterControls";

const { Header } = Layout;

type AppHeaderProps = {
  showFilters: boolean;
  lockFilters?: boolean;
  isXlUp: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  filters: CaseFilterControls;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  showFilters,
  lockFilters = false,
  isXlUp,
  filtersOpen,
  onToggleFilters,
  onCloseFilters,
  filters,
}) => {
  const navigate = useNavigate();
  return (
    <Header className="app-header">
      <div className="app-header-brand">
        <button
          type="button"
          className="app-header-logo-button"
          aria-label="Go to cases"
          onClick={() => navigate("/")}
        >
          <img className="app-header-logo" src="/miranda-logotype.svg" alt="Miranda" />
        </button>
      </div>
      {!showFilters ? null : !isXlUp ? (
        lockFilters ? null : (
          <>
            <Button
              type="text"
              className="app-header-filter-toggle"
              onClick={onToggleFilters}
            >
              {filtersOpen ? "Close" : "Filters"}
            </Button>
            {filtersOpen ? (
              <div
                className="app-header-mobile-filter-overlay"
                onClick={onCloseFilters}
                role="presentation"
              >
                <div
                  className="app-header-mobile-filter-panel"
                  onClick={(event) => event.stopPropagation()}
                >
                  <CaseFilters
                    compact
                    authorOptions={filters.authorOptions}
                    tagOptions={filters.tagOptions}
                    courtOptions={filters.courtOptions}
                    selectedAuthor={filters.selectedAuthor}
                    onAuthorChange={filters.onAuthorChange}
                    selectedTagIds={filters.selectedTagIds}
                    onTagChange={filters.onTagChange}
                    selectedCourt={filters.selectedCourt}
                    onCourtChange={filters.onCourtChange}
                    nameQuery={filters.nameQuery}
                    onNameQueryChange={filters.onNameQueryChange}
                    sortOrder={filters.sortOrder}
                    onSortOrderChange={filters.onSortOrderChange}
                  />
                </div>
              </div>
            ) : null}
          </>
        )
      ) : lockFilters && !isXlUp ? null : (
        <div className="app-header-filters">
          <CaseFilters
            authorOptions={filters.authorOptions}
            tagOptions={filters.tagOptions}
            courtOptions={filters.courtOptions}
            selectedAuthor={filters.selectedAuthor}
            onAuthorChange={filters.onAuthorChange}
            selectedTagIds={filters.selectedTagIds}
            onTagChange={filters.onTagChange}
            selectedCourt={filters.selectedCourt}
            onCourtChange={filters.onCourtChange}
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
