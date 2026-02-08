import React, { useState } from "react";
import { Input, Select } from "antd";

type Option = { value: string; label: string };

type CaseFiltersProps = {
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
  disabled?: boolean;
  compact?: boolean;
  wrapClassName?: string;
};

const CaseFilters: React.FC<CaseFiltersProps> = ({
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
  disabled = false,
  compact = false,
  wrapClassName,
}) => {
  const [tagOpen, setTagOpen] = useState(false);
  const selectStyle = compact ? undefined : { minWidth: 200 };
  const inputStyle = compact ? undefined : { minWidth: 240 };

  const items = [
    {
      key: "author",
      node: (
        <Select
          allowClear
          placeholder="Author"
          options={authorOptions}
          value={selectedAuthor ?? undefined}
          onChange={(value) => onAuthorChange(value ?? null)}
          style={selectStyle}
          disabled={disabled}
        />
      ),
    },
    {
      key: "tags",
      node: (
        <Select
          mode="multiple"
          allowClear
          placeholder="Tags"
          showSearch={false}
          filterOption={false}
          className="case-tags-select"
          options={tagOptions}
          value={selectedTagIds.length ? selectedTagIds : undefined}
          maxTagTextLength={0}
          maxTagCount={0}
          maxTagPlaceholder={() => null}
          onChange={(value) => {
            const next = (value as string[]).slice();
            const hasAny = next.includes("__any__");
            if (hasAny && next.length === 1) {
              onTagChange(["__any__"]);
              setTagOpen(false);
              return;
            }
            const filtered = next.filter((item) => item !== "__any__");
            if (filtered.length > 2) {
              onTagChange(filtered.slice(0, 2));
              return;
            }
            onTagChange(filtered);
          }}
          open={tagOpen}
          onDropdownVisibleChange={setTagOpen}
          style={selectStyle}
          disabled={disabled}
        />
      ),
    },
    {
      key: "search",
      node: (
        <Input
          placeholder="Search case name"
          value={nameQuery}
          allowClear
          onChange={(event) => onNameQueryChange(event.target.value)}
          style={inputStyle}
          disabled={disabled}
        />
      ),
    },
    {
      key: "sort",
      node: (
        <Select
          value={sortOrder}
          onChange={(value) => onSortOrderChange(value)}
          options={[
            { value: "date_desc", label: "Date (newest)" },
            { value: "date_asc", label: "Date (oldest)" },
            { value: "name_asc", label: "Case name (A–Z)" },
            { value: "name_desc", label: "Case name (Z–A)" },
          ]}
          style={selectStyle}
          disabled={disabled}
        />
      ),
    },
  ];

  if (!wrapClassName) {
    return <>{items.map((item) => item.node)}</>;
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.key} className={wrapClassName}>
          {item.node}
        </div>
      ))}
    </>
  );
};

export default CaseFilters;
