import React, { useState } from "react";
import { Button, Dropdown, Input, Select } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";

type Option = { value: string; label: string };

type CaseFiltersProps = {
  authorOptions: Option[];
  tagOptions: Option[];
  courtOptions: Option[];
  selectedAuthor: string | null;
  onAuthorChange: (value: string | null) => void;
  selectedTagIds: string[];
  onTagChange: (value: string[]) => void;
  selectedCourt: string | null;
  onCourtChange: (value: string | null) => void;
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
  courtOptions,
  selectedAuthor,
  onAuthorChange,
  selectedTagIds,
  onTagChange,
  selectedCourt,
  onCourtChange,
  nameQuery,
  onNameQueryChange,
  sortOrder,
  onSortOrderChange,
  disabled = false,
  compact = false,
  wrapClassName,
}) => {
  const [tagOpen, setTagOpen] = useState(false);
  const [authorOpen, setAuthorOpen] = useState(false);
  const [courtOpen, setCourtOpen] = useState(false);
  const dropdownMenuStyle = { maxHeight: 320, overflowY: "auto" as const };
  const selectStyle = compact ? undefined : { minWidth: 200 };
  const inputStyle = compact ? undefined : { minWidth: 240 };

  const items = [
    {
      key: "court",
      node: (
        <Dropdown
          trigger={["click"]}
          open={courtOpen}
          onOpenChange={setCourtOpen}
          menu={{
            style: dropdownMenuStyle,
            items: [
              ...(selectedCourt ? [{ key: "__clear__", label: "All Courts" }] : []),
              ...courtOptions.map((option) => ({
                key: option.value,
                label: option.label,
              })),
            ],
            selectable: true,
            multiple: false,
            selectedKeys: selectedCourt ? [selectedCourt] : [],
            onSelect: (info) => {
              if (info.key === "__clear__") {
                onCourtChange(null);
              } else {
                onCourtChange(info.key as string);
              }
              setCourtOpen(false);
            },
          }}
          disabled={disabled}
        >
          <Button className="case-tags-trigger" style={selectStyle}>
            {selectedCourt
              ? courtOptions.find((option) => option.value === selectedCourt)?.label ?? selectedCourt
              : "All Courts"}
            {selectedCourt ? (
              <button
                type="button"
                className="case-filter-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  onCourtChange(null);
                }}
                aria-label="Clear court filter"
              >
                <CloseCircleOutlined />
              </button>
            ) : null}
          </Button>
        </Dropdown>
      ),
    },
    {
      key: "author",
      node: (
        <Dropdown
          trigger={["click"]}
          open={authorOpen}
          onOpenChange={setAuthorOpen}
          menu={{
            style: dropdownMenuStyle,
            items: [
              ...(selectedAuthor
                ? [{ key: "__clear__", label: "All Authors" }]
                : []),
              ...authorOptions.map((option) => ({
                key: option.value,
                label: option.label,
              })),
            ],
            selectable: true,
            multiple: false,
            selectedKeys: selectedAuthor ? [selectedAuthor] : [],
            onSelect: (info) => {
              if (info.key === "__clear__") {
                onAuthorChange(null);
              } else {
                onAuthorChange(info.key as string);
              }
              setAuthorOpen(false);
            },
          }}
          disabled={disabled}
        >
          <Button className="case-tags-trigger" style={selectStyle}>
            {selectedAuthor ?? "All Authors"}
            {selectedAuthor ? (
              <button
                type="button"
                className="case-filter-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  onAuthorChange(null);
                }}
                aria-label="Clear author filter"
              >
                <CloseCircleOutlined />
              </button>
            ) : null}
          </Button>
        </Dropdown>
      ),
    },
    {
      key: "tags",
      node: (
        <Dropdown
          trigger={["click"]}
          open={tagOpen}
          onOpenChange={setTagOpen}
          menu={{
            style: dropdownMenuStyle,
            items: tagOptions.map((option) => ({
              key: option.value,
              label: option.label,
            })),
            selectable: true,
            multiple: true,
            selectedKeys: selectedTagIds,
            onSelect: (info) => {
              const next = Array.from(
                new Set([...selectedTagIds, info.key as string]),
              );
              if (next.length > 3) {
                setTagOpen(false);
                return;
              }
              onTagChange(next);
              setTagOpen(false);
            },
            onDeselect: (info) => {
              const next = selectedTagIds.filter((id) => id !== info.key);
              onTagChange(next);
              setTagOpen(false);
            },
          }}
          disabled={disabled}
        >
          <Button className="case-tags-trigger" style={selectStyle}>
            {`Tags${selectedTagIds.length ? ` (${selectedTagIds.length})` : ""}`}
            {selectedTagIds.length ? (
              <button
                type="button"
                className="case-filter-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  onTagChange([]);
                }}
                aria-label="Clear tag filters"
              >
                <CloseCircleOutlined />
              </button>
            ) : null}
          </Button>
        </Dropdown>
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
