import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Modal, Spin } from "antd";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

type TagRow = Schema["Tag"]["type"];

type TagModalMode = "create" | "edit";

const sortTags = (values: TagRow[]) =>
  [...values].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
  );

export default function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TagModalMode>("create");
  const [activeTag, setActiveTag] = useState<TagRow | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadTags() {
      try {
        setLoading(true);
        const { data } = await client.models.Tag.list({ limit: 5000 });
        if (!active) return;
        setTags(data ?? []);
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

  const openCreateModal = () => {
    setModalMode("create");
    setActiveTag(null);
    setLabelInput("");
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (tag: TagRow) => {
    setModalMode("edit");
    setActiveTag(tag);
    setLabelInput(tag.label ?? "");
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setModalError(null);
  };

  const handleSave = async () => {
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
        const result = await client.models.Tag.create({ tagId, label: trimmed });
        const created = result?.data ?? null;
        if (created) {
          setTags((prev) => sortTags([...prev, created]));
        }
      } else if (activeTag) {
        const result = await client.models.Tag.update({
          tagId: activeTag.tagId,
          label: trimmed,
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
        <div className="tags-grid">
          {sortedTags.map((tag) => (
            <Card key={tag.tagId} className="tag-card" size="small">
              <button
                type="button"
                className="tag-card__label"
                onClick={() => openEditModal(tag)}
                aria-label={`Edit ${tag.label ?? "tag"}`}
              >
                {tag.label}
              </button>
            </Card>
          ))}
          <button type="button" className="tag-card tag-card--new" onClick={openCreateModal}>
            + Tag
          </button>
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
          {modalError ? (
            <Alert type="error" message={modalError} showIcon style={{ marginTop: 12 }} />
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
