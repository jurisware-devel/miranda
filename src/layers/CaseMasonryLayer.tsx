import React from "react";
import { Alert, Masonry, Spin } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import CaseFilters from "../components/CaseFilters";
import CaseCard from "../components/CaseCard";
import type { CaseItem } from "../logic/types";
import type { TagMeta } from "../logic/tagUtils";
import TagCapsule from "../components/TagCapsule";
import { getReadableTextColor } from "../logic/colorUtils";

type Option = { value: string; label: string };

type CaseMasonryLayerProps = {
  isMobile: boolean;
  filtersOpen: boolean;
  error: string | null;
  tagsError: string | null;
  caseTagsError: string | null;
  loading: boolean;
  totalCases: number;
  filteredCount: number;
  cases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  onOpenCase: (caseId: string) => void;
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

const CaseMasonryLayer: React.FC<CaseMasonryLayerProps> = ({
  isMobile,
  filtersOpen,
  error,
  tagsError,
  caseTagsError,
  loading,
  totalCases,
  filteredCount,
  cases,
  tagsById,
  caseTagsByCaseId,
  onOpenCase,
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
  const masonryItems = cases.map((item) => ({ key: item.caseId, data: item }));
  const activeTags = selectedTagIds;
  const showActiveTags = activeTags.length > 0;

  return (
    <div
      className={`masonry-wrap${showActiveTags ? " masonry-wrap--with-tags" : ""}`}
    >
      {showActiveTags ? (
        <div className="case-active-tags">
          {activeTags.map((tagId) => {
            const isAny = tagId === "__any__";
            const tag = tagsById.get(tagId);
            const label = isAny ? "[Any Tag]" : tag?.label ?? "Untitled";
            const background = isAny ? "#e2e8f0" : tag?.color ?? undefined;
            const color = getReadableTextColor(background, "#0f172a");
            return (
              <TagCapsule
                key={tagId}
                label={label}
                background={background}
                color={color}
                size="md"
                rightSlot={
                  <button
                    type="button"
                    className="case-active-tags__remove"
                    aria-label={`Remove ${label}`}
                    onClick={() => {
                      const next = activeTags.filter((value) => value !== tagId);
                      onTagChange(next);
                    }}
                  >
                    <CloseCircleOutlined />
                  </button>
                }
              />
            );
          })}
        </div>
      ) : null}
      {isMobile && filtersOpen ? (
        <div className="filter-panel">
          <CaseFilters
            compact
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
          />
        </div>
      ) : null}
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {tagsError ? <Alert type="error" message={tagsError} showIcon /> : null}
      {caseTagsError ? <Alert type="error" message={caseTagsError} showIcon /> : null}
      {loading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : (
        <Masonry
          columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
          gutter={{ xs: 8, sm: 12, md: 16 }}
          items={masonryItems}
          itemRender={({ data, index }) => {
            const tagIds = caseTagsByCaseId.get(data.caseId) ?? [];
            return (
              <CaseCard
                caseItem={data}
                index={index}
                tagIds={tagIds}
                tagsById={tagsById}
                onOpenCase={onOpenCase}
              />
            );
          }}
        />
      )}
    </div>
  );
};

export default CaseMasonryLayer;
