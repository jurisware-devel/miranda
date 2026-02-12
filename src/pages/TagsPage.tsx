import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Spin,
  Masonry,
  ColorPicker,
  Select,
} from "antd";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { EditOutlined, CloseCircleOutlined, UndoOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { darkenHex, getReadableTextColor } from "../logic/colorUtils";
import TagCapsule from "../components/TagCapsule";

const client = generateClient<Schema>();

type TagRow = Schema["Tag"]["type"];
const TAG_PALETTE = [
  { bg: "#E0F2FE", text: "#0C4A6E" },
  { bg: "#DCFCE7", text: "#166534" },
  { bg: "#FFE4E6", text: "#9F1239" },
  { bg: "#FEF3C7", text: "#92400E" },
  { bg: "#EDE9FE", text: "#5B21B6" },
  { bg: "#ECFEFF", text: "#155E75" },
  { bg: "#FEE2E2", text: "#991B1B" },
  { bg: "#E2E8F0", text: "#1E293B" },
  { bg: "#FCE7F3", text: "#9D174D" },
  { bg: "#D1FAE5", text: "#065F46" },
  { bg: "#FDE68A", text: "#78350F" },
  { bg: "#DBEAFE", text: "#1D4ED8" },
];

const sortTags = (values: TagRow[]) =>
  [...values].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
  );

type TagsPageProps = {
  canEdit?: boolean;
  basePath?: string;
};

export default function TagsPage({ canEdit = false, basePath = "" }: TagsPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const rootPath = basePath || "/";
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseTags, setCaseTags] = useState<Schema["CaseTag"]["type"][]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "edit">("edit");
  const [editTag, setEditTag] = useState<TagRow | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState<string>("#E2E8F0");
  const [editParentId, setEditParentId] = useState<string | null>(null);
  const [childEdits, setChildEdits] = useState<Record<string, boolean>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadTags() {
      try {
        setLoading(true);
        const [{ data: tagData }, { data: caseTagData }] = await Promise.all([
          client.models.Tag.list({ limit: 5000 }),
          client.models.CaseTag.list({ limit: 5000 }),
        ]);
        if (!active) return;
        setTags(tagData ?? []);
        setCaseTags(caseTagData ?? []);
        setError(null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load tags");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTags();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const state = (location.state as { openCreateTag?: boolean } | null) ?? null;
    if (!state?.openCreateTag || !canEdit) return;
    openCreateModal();
    navigate(".", { replace: true, state: null });
  }, [location.state, canEdit, navigate]);

  const refreshTags = async () => {
    const [{ data: tagData }, { data: caseTagData }] = await Promise.all([
      client.models.Tag.list({ limit: 5000 }),
      client.models.CaseTag.list({ limit: 5000 }),
    ]);
    setTags(tagData ?? []);
    setCaseTags(caseTagData ?? []);
  };

  const sortedTags = useMemo(() => sortTags(tags), [tags]);

  const tagChildren = useMemo(() => {
    const map = new Map<string | null, TagRow[]>();
    for (const tag of sortedTags) {
      const key = tag.parentTagId ?? null;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(tag);
    }
    return map;
  }, [sortedTags]);

  const openEditModal = (tag: TagRow) => {
    if (!canEdit) return;
    const children = tagChildren.get(tag.tagId) ?? [];
    const edits: Record<string, boolean> = {};
    for (const child of children) {
      edits[child.tagId] = false;
    }
    setEditMode("edit");
    setEditTag(tag);
    setEditLabel(tag.label ?? "");
    setEditColor(tag.color ?? "#E2E8F0");
    setEditParentId(tag.parentTagId ?? null);
    setChildEdits(edits);
    setEditError(null);
    setEditModalOpen(true);
  };

  const openCreateModal = () => {
    if (!canEdit) return;
    setEditMode("create");
    setEditTag(null);
    setEditLabel("");
    setEditColor(TAG_PALETTE[0]?.bg ?? "#E2E8F0");
    setEditParentId(null);
    setChildEdits({});
    setEditError(null);
    setEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setEditModalOpen(false);
    setEditError(null);
  };

  const handleEditSave = async () => {
    const trimmed = editLabel.trim();
    if (!trimmed) {
      setEditError("Tag label is required.");
      return;
    }
    try {
      setEditSaving(true);
      setEditError(null);
      const updates: Promise<unknown>[] = [];
      const nextParentId = editParentId ?? null;
      const nextColor = nextParentId ? null : editColor;
      if (editMode === "create") {
        updates.push(
          client.models.Tag.create({
            tagId: crypto.randomUUID(),
            label: trimmed,
            parentTagId: nextParentId,
            color: nextColor,
          }),
        );
      } else if (editTag) {
        if (
          trimmed !== (editTag.label ?? "") ||
          nextColor !== (editTag.color ?? "") ||
          nextParentId !== (editTag.parentTagId ?? null)
        ) {
          updates.push(
            client.models.Tag.update({
              tagId: editTag.tagId,
              label: trimmed,
              parentTagId: nextParentId,
              color: nextColor,
            }),
          );
        }
        for (const [childId, state] of Object.entries(childEdits)) {
          const child = tags.find((item) => item.tagId === childId);
          if (!child) continue;
          if (state) {
            updates.push(
              client.models.Tag.update({
                tagId: child.tagId,
                label: child.label ?? "",
                parentTagId: null,
                color: null,
              }),
            );
            continue;
          }
        }
      }
      if (updates.length) {
        await Promise.all(updates);
      }
      await refreshTags();
      setEditModalOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditDelete = async () => {
    if (!editTag) return;
    const isInUse = caseTags.some((item) => item.tagId === editTag.tagId);
    const hasChildren = (tagChildren.get(editTag.tagId) ?? []).length > 0;
    if (isInUse || hasChildren) {
      setEditError("Tags with children or associated cases cannot be deleted.");
      return;
    }
    try {
      setEditSaving(true);
      setEditError(null);
      await client.models.Tag.delete({ tagId: editTag.tagId });
      await refreshTags();
      setEditModalOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setEditSaving(false);
    }
  };

  const tagCaseCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of caseTags) {
      map.set(item.tagId, (map.get(item.tagId) ?? 0) + 1);
    }
    return map;
  }, [caseTags]);

  const formatTagLabel = (tag: TagRow) => {
    const count = tagCaseCounts.get(tag.tagId) ?? 0;
    if (count <= 0) return tag.label ?? "Untitled";
    return `${tag.label ?? "Untitled"} (${count})`;
  };

  const rootTags = useMemo(() => {
    const ids = new Set(sortedTags.map((tag) => tag.tagId));
    return sortedTags.filter(
      (tag) => !tag.parentTagId || !ids.has(tag.parentTagId),
    );
  }, [sortedTags]);

  const tagColorMap = useMemo(() => {
    const map = new Map<string, { bg: string; text: string }>();
    rootTags.forEach((tag, index) => {
      const color = TAG_PALETTE[index % TAG_PALETTE.length];
      const bg = tag.color ?? color.bg;
      const text = color.text;
      map.set(tag.tagId, { bg, text });
    });
    return map;
  }, [rootTags]);

  // color helpers in colorUtils

  const masonryItems = useMemo(
    () => rootTags.map((tag) => ({ key: tag.tagId, data: { tag } })),
    [rootTags],
  );

  return (
    <div className="tags-page">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {loading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : (
        <div className="tags-masonry-wrap">
          <Masonry
            columns={{ xs: 1, sm: 2, md: 3, lg: 4 }}
            gutter={{ xs: 12, sm: 12, md: 16 }}
            items={masonryItems}
            itemRender={({ data }) => {
              if (!data.tag) {
                return null;
              }
              const tag = data.tag;
              const children = tagChildren.get(tag.tagId) ?? [];
              const hasChildren = children.length > 0;
              const color =
                tagColorMap.get(tag.tagId) ?? { bg: "#E2E8F0", text: "#1E293B" };
              const parentBg = darkenHex(color.bg, 0.08);
              const parentText = getReadableTextColor(parentBg, color.text);
              const childText = getReadableTextColor(color.bg, color.text);
              return (
                <div className="tags-masonry-item">
                  <Card
                    className={`tag-card tag-card--parent${
                      hasChildren ? "" : " tag-card--parent-empty"
                    }`}
                    size="small"
                  >
                    {canEdit ? (
                      <button
                        type="button"
                        className="tag-card__edit"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditModal(tag);
                        }}
                        aria-label={`Edit ${tag.label ?? "tag"}`}
                      >
                        <EditOutlined />
                      </button>
                    ) : null}
                    <TagCapsule
                      size="lg"
                      label={formatTagLabel(tag)}
                      background={parentBg}
                      color={parentText}
                      onClick={() => navigate(rootPath, { state: { tagId: tag.tagId } })}
                      className="tag-card__title"
                      ariaLabel={`Filter by ${tag.label ?? "tag"}`}
                    />
                    {hasChildren ? (
                      <div className="tag-card__children">
                        {children.map((child) => (
                          <TagCapsule
                            key={child.tagId}
                            label={formatTagLabel(child)}
                            background={color.bg}
                            color={childText}
                            onClick={() =>
                              navigate(rootPath, { state: { tagId: child.tagId } })
                            }
                            className="tag-card__child"
                            ariaLabel={`Filter by ${child.label ?? "tag"}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </Card>
                </div>
              );
            }}
          />
        </div>
      )}
      <Modal
        open={editModalOpen}
        onCancel={closeEditModal}
        title={editMode === "create" ? "New Tag" : "Edit Tag"}
        footer={
          editMode === "edit" && editTag
            ? [
                <Button
                  key="delete"
                  danger
                  onClick={handleEditDelete}
                  disabled={
                    editSaving ||
                    caseTags.some((item) => item.tagId === editTag.tagId) ||
                    (tagChildren.get(editTag.tagId) ?? []).length > 0
                  }
                >
                  Delete
                </Button>,
                <Button key="cancel" onClick={closeEditModal} disabled={editSaving}>
                  Cancel
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  onClick={handleEditSave}
                  loading={editSaving}
                >
                  Save
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={closeEditModal} disabled={editSaving}>
                  Cancel
                </Button>,
                <Button
                  key="create"
                  type="primary"
                  onClick={handleEditSave}
                  loading={editSaving}
                >
                  Create
                </Button>,
              ]
        }
      >
        {editMode === "edit" || editMode === "create" ? (
          <div className="tags-modal">
            <div className="tags-modal__row">
              <div className="tags-modal__field">
                <label className="tags-modal__label" htmlFor="tag-label-input">
                  Label
                </label>
                <Input
                  id="tag-label-input"
                  value={editLabel}
                  onChange={(event) => setEditLabel(event.target.value)}
                />
              </div>
              {editParentId ? null : (
                <ColorPicker
                  value={editColor}
                  disabledAlpha
                  presets={[
                    {
                      label: "Tag Colors",
                      colors: TAG_PALETTE.map((item) => item.bg),
                    },
                  ]}
                  onChange={(value) => setEditColor(value.toHexString())}
                >
                  <button
                    type="button"
                    className="tags-modal__color-swatch"
                    aria-label="Group color"
                    style={{ background: editColor }}
                  />
                </ColorPicker>
              )}
            </div>
            {editMode === "create" ||
            (editTag && (tagChildren.get(editTag.tagId) ?? []).length === 0) ? (
              <>
                <label className="tags-modal__label" htmlFor="tag-parent-select">
                  Parent
                </label>
                <Select
                  id="tag-parent-select"
                  value={editParentId ?? undefined}
                  allowClear
                  placeholder="No parent"
                  options={sortedTags
                    .filter((tag) => !tag.parentTagId)
                    .filter((tag) => (editTag ? tag.tagId !== editTag.tagId : true))
                    .map((tag) => ({
                      value: tag.tagId,
                      label: tag.label ?? "Untitled",
                    }))}
                  onChange={(value) => setEditParentId(value ?? null)}
                />
              </>
            ) : null}
            {editMode === "edit" &&
            editTag &&
            (tagChildren.get(editTag.tagId) ?? []).length ? (
              <div className="tags-modal__section">
                <div className="tags-modal__label">Child tags</div>
                {(tagChildren.get(editTag.tagId) ?? []).map((child) => {
                  const isDisassociated = childEdits[child.tagId] ?? false;
                  return (
                    <div key={child.tagId} className="tags-modal__child-row">
                      <TagCapsule
                        label={child.label ?? "Untitled"}
                        background={editColor}
                        color={getReadableTextColor(editColor)}
                        className={
                          isDisassociated ? "tags-modal__child-pill--muted" : undefined
                        }
                        rightSlot={
                          <button
                            type="button"
                            className="tags-modal__child-remove"
                            onClick={() =>
                              setChildEdits((prev) => ({
                                ...prev,
                                [child.tagId]: !prev[child.tagId],
                              }))
                            }
                            aria-label={
                              isDisassociated
                                ? `Undo disassociate ${child.label ?? "tag"}`
                                : `Disassociate ${child.label ?? "tag"}`
                            }
                          >
                            {isDisassociated ? <UndoOutlined /> : <CloseCircleOutlined />}
                          </button>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
            {editError ? (
              <Alert type="error" message={editError} showIcon style={{ marginTop: 12 }} />
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
