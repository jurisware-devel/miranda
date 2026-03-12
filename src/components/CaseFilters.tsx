import React, { useState } from "react";
import { Button, Dropdown, Input, Select } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";

type Option = { value: string; label: string };

type CaseFiltersProps = {
  phaseOptions: Option[];
  courtOptions: Option[];
  selectedPhase: string | null;
  onPhaseChange: (value: string | null) => void;
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
  phaseOptions,
  courtOptions,
  selectedPhase,
  onPhaseChange,
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
  const [phaseOpen, setPhaseOpen] = useState(false);
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
      key: "phase",
      node: (
        <Dropdown
          trigger={["click"]}
          open={phaseOpen}
          onOpenChange={setPhaseOpen}
          menu={{
            style: dropdownMenuStyle,
            items: [
              ...(selectedPhase ? [{ key: "__clear__", label: "All Phases" }] : []),
              ...phaseOptions.map((option) => ({
                key: option.value,
                label: option.label,
              })),
            ],
            selectable: true,
            multiple: false,
            selectedKeys: selectedPhase ? [selectedPhase] : [],
            onSelect: (info) => {
              if (info.key === "__clear__") {
                onPhaseChange(null);
              } else {
                onPhaseChange(info.key as string);
              }
              setPhaseOpen(false);
            },
          }}
          disabled={disabled}
        >
          <Button className="case-tags-trigger" style={selectStyle}>
            {selectedPhase
              ? phaseOptions.find((option) => option.value === selectedPhase)?.label ?? selectedPhase
              : "All Phases"}
            {selectedPhase ? (
              <button
                type="button"
                className="case-filter-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  onPhaseChange(null);
                }}
                aria-label="Clear phase filter"
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
