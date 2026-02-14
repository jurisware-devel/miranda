export type FilterOption = { value: string; label: string };

export type CaseFilterControls = {
  authorOptions: FilterOption[];
  tagOptions: FilterOption[];
  selectedAuthor: string | null;
  onAuthorChange: (value: string | null) => void;
  selectedTagIds: string[];
  onTagChange: (value: string[]) => void;
  nameQuery: string;
  onNameQueryChange: (value: string) => void;
  sortOrder: string;
  onSortOrderChange: (value: string) => void;
};
