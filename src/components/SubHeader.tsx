import React from "react";
import { Button, Layout } from "antd";
import { useNavigate } from "react-router-dom";
import SubCaseFilters from "./SubCaseFilters";
import SubProfileMenu from "./SubProfileMenu";
import type { CaseFilterControls } from "../core/filterControls";
import type { MenuProps } from "antd";

const { Header } = Layout;

type SubHeaderProps = {
  showFilters: boolean;
  lockFilters?: boolean;
  isXlUp: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  filters: CaseFilterControls;
  profileItems: MenuProps["items"];
  onProfileClick: NonNullable<MenuProps["onClick"]>;
  homePath?: string;
};

const SubHeader: React.FC<SubHeaderProps> = ({
  showFilters,
  lockFilters = false,
  isXlUp,
  filtersOpen,
  onToggleFilters,
  onCloseFilters,
  filters,
  profileItems,
  onProfileClick,
  homePath = "/sub",
}) => {
  const navigate = useNavigate();
  return (
    <Header className="app-header">
      <div className="app-header-brand">
        <button
          type="button"
          className="app-header-logo-button"
          aria-label="Go to cases"
          onClick={() => navigate(homePath)}
        >
          <img className="app-header-logo" src="/miranda-logotype.svg" alt="Miranda" />
        </button>
      </div>
      <div className="app-header-right">
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
                    <SubCaseFilters
                      compact
                      phaseOptions={filters.phaseOptions}
                      courtOptions={filters.courtOptions}
                      selectedPhase={filters.selectedPhase}
                      onPhaseChange={filters.onPhaseChange}
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
            <SubCaseFilters
              phaseOptions={filters.phaseOptions}
              courtOptions={filters.courtOptions}
              selectedPhase={filters.selectedPhase}
              onPhaseChange={filters.onPhaseChange}
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
        <div className="app-header-profile">
          <SubProfileMenu
            items={profileItems}
            onClick={onProfileClick}
            label="Open account menu"
          />
        </div>
      </div>
    </Header>
  );
};

export default SubHeader;
