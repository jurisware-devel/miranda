import React from "react";
import { Button, Layout } from "antd";
import { useNavigate } from "react-router-dom";
import CaseFilters from "./CaseFilters";
import ProfileMenu from "./ProfileMenu";
import type { CaseFilterControls } from "../core/filterControls";
import type { MenuProps } from "antd";

const { Header } = Layout;

type AppHeaderProps = {
  showFilters: boolean;
  lockFilters?: boolean;
  isXlUp: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  filters: CaseFilterControls;
  profileItems: MenuProps["items"];
  onProfileClick: NonNullable<MenuProps["onClick"]>;
};

const AppHeader: React.FC<AppHeaderProps> = ({
  showFilters,
  lockFilters = false,
  isXlUp,
  filtersOpen,
  onToggleFilters,
  onCloseFilters,
  filters,
  profileItems,
  onProfileClick,
}) => {
  const navigate = useNavigate();
  return (
    <Header className="app-header">
      <div className="app-header-brand">
        <button
          type="button"
          className="app-header-logo-button"
          aria-label="Go to cases"
          onClick={() => navigate("/pub")}
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
                    <CaseFilters
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
            <CaseFilters
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
          <ProfileMenu
            items={profileItems}
            onClick={onProfileClick}
            label="Open account menu"
          />
        </div>
      </div>
    </Header>
  );
};

export default AppHeader;
