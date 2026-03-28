export type FilterOption = { value: string; label: string };

export type CaseFilterControls = {
  phaseOptions: FilterOption[];
  courtOptions: FilterOption[];
  publicationStatusOptions: FilterOption[];
  selectedPhase: string | null;
  onPhaseChange: (value: string | null) => void;
  selectedTagIds: string[];
  onTagChange: (value: string[]) => void;
  selectedCourt: string | null;
  onCourtChange: (value: string | null) => void;
  selectedPublicationStatus: string | null;
  onPublicationStatusChange: (value: string | null) => void;
  nameQuery: string;
  onNameQueryChange: (value: string) => void;
  sortOrder: string;
  onSortOrderChange: (value: string) => void;
};
