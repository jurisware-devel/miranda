import React from "react";
import { Alert, Masonry, Spin } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import SubCaseCard from "../components/SubCaseCard";
import type { CaseFilterControls } from "../core/filterControls";
import type { CaseItem, PhaseItem } from "../core/types";
import type { TagMeta } from "../core/utils/tagUtils";
import SubTagCapsule from "../components/SubTagCapsule";
import { getReadableTextColor } from "../core/utils/colorUtils";

type SubCaseMasonryLayerProps = {
  error: string | null;
  tagsError: string | null;
  caseTagsError: string | null;
  casePhasesError: string | null;
  loading: boolean;
  cases: CaseItem[];
  tagsById: Map<string, TagMeta>;
  caseTagsByCaseId: Map<string, string[]>;
  casePhasesByCaseId: Map<string, PhaseItem[]>;
  onOpenCase: (caseId: string) => void;
  filters: CaseFilterControls;
};

const SubCaseMasonryLayer: React.FC<SubCaseMasonryLayerProps> = ({
  error,
  tagsError,
  caseTagsError,
  casePhasesError,
  loading,
  cases,
  tagsById,
  caseTagsByCaseId,
  casePhasesByCaseId,
  onOpenCase,
  filters,
}) => {
  const masonryItems = cases.map((item) => ({ key: item.caseId, data: item }));
  const activeTags = filters.selectedTagIds;
  const showActiveTags = activeTags.length > 0;

  return (
    <div className="masonry-wrap">
      <div className="case-filter-bar">
        {showActiveTags ? (
          <div className="case-active-tags">
            {activeTags.map((tagId) => {
              const tag = tagsById.get(tagId);
              const label = tag?.label ?? "Untitled";
              const background = tag?.color ?? undefined;
              const color = getReadableTextColor(background, "#0f172a");
              return (
                <SubTagCapsule
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
                        filters.onTagChange(next);
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
      </div>
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {tagsError ? <Alert type="error" message={tagsError} showIcon /> : null}
      {caseTagsError ? <Alert type="error" message={caseTagsError} showIcon /> : null}
      {casePhasesError ? <Alert type="error" message={casePhasesError} showIcon /> : null}
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
            const phases = casePhasesByCaseId.get(data.caseId) ?? [];
            return (
              <SubCaseCard
                caseItem={data}
                index={index}
                phases={phases}
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

export default SubCaseMasonryLayer;
