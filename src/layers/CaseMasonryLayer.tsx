import React from "react";
import { Alert, Masonry, Spin } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import CaseCard from "../components/CaseCard";
import type { CaseItem, CourtItem, PhaseId } from "../core/types";
import type { TagMeta } from "../core/utils/tagUtils";
import TagCapsule from "../components/TagCapsule";
import { getReadableTextColor } from "../core/utils/colorUtils";
import type { CaseFilterControls } from "../core/filterControls";

type CaseMasonryLayerProps = {
  error: string | null;
  tagsError: string | null;
  phasesError: string | null;
  caseTagsError: string | null;
  casePhasesError: string | null;
  loading: boolean;
  cases: CaseItem[];
  courtsById: Map<string, CourtItem>;
  tagsById: Map<string, TagMeta>;
  phasesById: Map<string, string>;
  caseTagsByCaseId: Map<string, string[]>;
  casePhasesByCaseId: Map<string, PhaseId[]>;
  onOpenCase: (caseId: string) => void;
  filters: CaseFilterControls;
};

const CaseMasonryLayer: React.FC<CaseMasonryLayerProps> = ({
  error,
  tagsError,
  phasesError,
  caseTagsError,
  casePhasesError,
  loading,
  cases,
  courtsById,
  tagsById,
  phasesById,
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
      {phasesError ? <Alert type="error" message={phasesError} showIcon /> : null}
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
              <CaseCard
                caseItem={data}
                courtsById={courtsById}
                index={index}
                phases={phases}
                phasesById={phasesById}
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
