import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Modal, Spin, Select } from "antd";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { useAuth } from "../logic/auth/useAuth";

const client = generateClient<Schema>();

type TagRow = Schema["Tag"]["type"];
type TagModalMode = "create" | "edit";

const sortTags = (values: TagRow[]) =>
  [...values].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
  );

type TagTreeNodeItem = {
  tag: TagRow;
  depth: number;
  children: TagTreeNodeItem[];
};

const TagTreeNode = ({
  node,
  onEdit,
  canEdit,
}: {
  node: TagTreeNodeItem;
  onEdit: (tag: TagRow) => void;
  canEdit: boolean;
}) => (
  <div className="tags-tree__node">
    <Card className="tag-card tag-card--tree" size="small">
      <button
        type="button"
        className="tag-card__label"
        onClick={() => (canEdit ? onEdit(node.tag) : null)}
        aria-label={`Edit ${node.tag.label ?? "tag"}`}
        disabled={!canEdit}
        style={{ paddingLeft: `${node.depth * 16}px` }}
      >
        {node.tag.label}
      </button>
    </Card>
    {node.children.length ? (
      <div className="tags-tree__children">
        {node.children.map((child) => (
          <TagTreeNode
            key={child.tag.tagId}
            node={child}
            onEdit={onEdit}
            canEdit={canEdit}
          />
        ))}
      </div>
    ) : null}
  </div>
);

export default function TagsPage() {
  const { role } = useAuth();
  const canEdit = role === "Admin";
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TagModalMode>("create");
  const [activeTag, setActiveTag] = useState<TagRow | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [parentTagInput, setParentTagInput] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadTags() {
      try {
        setLoading(true);
        const { data: tagData } = await client.models.Tag.list({ limit: 5000 });
        if (!active) return;
        setTags(tagData ?? []);
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

  const tagTree = useMemo<TagTreeNodeItem[]>(() => {
    const build = (parentId: string | null, depth: number): TagTreeNodeItem[] => {
      const children = tagChildren.get(parentId) ?? [];
      return children.map((tag) => ({
        tag,
        depth,
        children: build(tag.tagId, depth + 1),
      }));
    };
    const roots = build(null, 0);
    if (roots.length || !sortedTags.length) {
      return roots;
    }
    return sortedTags.map((tag) => ({
      tag,
      depth: 0,
      children: [],
    }));
  }, [sortedTags, tagChildren]);

  const openCreateModal = () => {
    if (!canEdit) return;
    setModalMode("create");
    setActiveTag(null);
    setLabelInput("");
    setParentTagInput(null);
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (tag: TagRow) => {
    if (!canEdit) return;
    setModalMode("edit");
    setActiveTag(tag);
    setLabelInput(tag.label ?? "");
    setParentTagInput(tag.parentTagId ?? null);
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setModalError(null);
  };

  const handleSave = async () => {
    if (!canEdit) {
      setModalError("Read-only access.");
      return;
    }
    const trimmed = labelInput.trim();
    if (!trimmed) {
      setModalError("Tag label is required.");
      return;
    }

    try {
      setSaving(true);
      setModalError(null);
      if (modalMode === "create") {
        const tagId = crypto.randomUUID();
        const result = await client.models.Tag.create({
          tagId,
          label: trimmed,
          parentTagId: parentTagInput ?? undefined,
        });
        const created = result?.data ?? null;
        if (created) {
          setTags((prev) => sortTags([...prev, created]));
        }
      } else if (activeTag) {
        const result = await client.models.Tag.update({
          tagId: activeTag.tagId,
          label: trimmed,
          parentTagId: parentTagInput ?? undefined,
        });
        const updated = result?.data ?? null;
        if (updated) {
          setTags((prev) =>
            prev.map((item) => (item.tagId === updated.tagId ? updated : item)),
          );
        }
      }
      setModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) {
      setModalError("Read-only access.");
      return;
    }
    if (!activeTag) return;
    try {
      setSaving(true);
      setModalError(null);
      await client.models.Tag.delete({ tagId: activeTag.tagId });
      setTags((prev) => prev.filter((item) => item.tagId !== activeTag.tagId));
      setModalOpen(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tags-page">
      {error ? <Alert type="error" message={error} showIcon /> : null}
      {loading ? (
        <div className="card-grid__loading">
          <Spin />
        </div>
      ) : (
        <div>
          <div className="tags-tree">
            {tagTree.map(({ tag, depth, children }) => (
              <TagTreeNode
                key={tag.tagId}
                node={{ tag, depth, children }}
                onEdit={openEditModal}
                canEdit={canEdit}
              />
            ))}
          </div>
          <div className="tags-grid">
            {canEdit ? (
              <button
                type="button"
                className="tag-card tag-card--new"
                onClick={openCreateModal}
              >
                + Tag
              </button>
            ) : null}
          </div>
        </div>
      )}
      <Modal
        open={modalOpen}
        onCancel={closeModal}
        title={modalMode === "create" ? "Create Tag" : "Edit Tag"}
        footer={
          modalMode === "edit"
            ? [
                <Button key="delete" danger onClick={handleDelete} disabled={saving}>
                  Delete
                </Button>,
                <Button key="cancel" onClick={closeModal} disabled={saving}>
                  Cancel
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  onClick={handleSave}
                  loading={saving}
                >
                  Save
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={closeModal} disabled={saving}>
                  Cancel
                </Button>,
                <Button
                  key="create"
                  type="primary"
                  onClick={handleSave}
                  loading={saving}
                >
                  Create
                </Button>,
              ]
        }
      >
        <div className="tags-modal">
          <label className="tags-modal__label" htmlFor="tag-label-input">
            Tag label
          </label>
          <Input
            id="tag-label-input"
            value={labelInput}
            onChange={(event) => setLabelInput(event.target.value)}
            placeholder="Enter tag label"
          />
          <label className="tags-modal__label" htmlFor="tag-category-select">
            Parent Tag
          </label>
          <Select
            id="tag-category-select"
            value={parentTagInput ?? undefined}
            allowClear
            placeholder="No parent"
            options={sortedTags
              .filter((tag) => tag.tagId !== activeTag?.tagId)
              .map((tag) => ({
                value: tag.tagId,
                label: tag.label ?? "Untitled",
              }))}
            onChange={(value) => setParentTagInput(value ?? null)}
          />
          {modalError ? (
            <Alert type="error" message={modalError} showIcon style={{ marginTop: 12 }} />
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
