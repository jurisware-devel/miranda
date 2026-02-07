import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Modal, Spin, Select } from "antd";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

type TagRow = Schema["Tag"]["type"];
type CategoryRow = Schema["Category"]["type"];

type TagModalMode = "create" | "edit";
type CategoryModalMode = "create" | "edit";

const sortTags = (values: TagRow[]) =>
  [...values].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
  );

const sortCategories = (values: CategoryRow[]) =>
  [...values].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "", undefined, { sensitivity: "base" }),
  );

export default function TagsPage() {
  const [tags, setTags] = useState<TagRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<TagModalMode>("create");
  const [activeTag, setActiveTag] = useState<TagRow | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [categoryInput, setCategoryInput] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] =
    useState<CategoryModalMode>("create");
  const [activeCategory, setActiveCategory] = useState<CategoryRow | null>(null);
  const [categoryLabelInput, setCategoryLabelInput] = useState("");
  const [categoryModalError, setCategoryModalError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadTags() {
      try {
        setLoading(true);
        const [{ data: tagData }, categoryResult] = await Promise.all([
          client.models.Tag.list({ limit: 5000 }),
          client.models.Category
            ? client.models.Category.list({ limit: 5000 })
            : Promise.resolve({ data: [] }),
        ]);
        if (!active) return;
        setTags(tagData ?? []);
        setCategories(categoryResult?.data ?? []);
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
  const sortedCategories = useMemo(() => sortCategories(categories), [categories]);

  const tagsByCategory = useMemo(() => {
    const map = new Map<string | null, TagRow[]>();
    for (const tag of sortedTags) {
      const key = tag.categoryId ?? null;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(tag);
    }
    return map;
  }, [sortedTags]);

  const openCreateModal = () => {
    setModalMode("create");
    setActiveTag(null);
    setLabelInput("");
    setCategoryInput(null);
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (tag: TagRow) => {
    setModalMode("edit");
    setActiveTag(tag);
    setLabelInput(tag.label ?? "");
    setCategoryInput(tag.categoryId ?? null);
    setModalError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setModalError(null);
  };

  const openCreateCategoryModal = () => {
    setCategoryModalMode("create");
    setActiveCategory(null);
    setCategoryLabelInput("");
    setCategoryModalError(null);
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category: CategoryRow) => {
    setCategoryModalMode("edit");
    setActiveCategory(category);
    setCategoryLabelInput(category.label ?? "");
    setCategoryModalError(null);
    setCategoryModalOpen(true);
  };

  const closeCategoryModal = () => {
    if (saving) return;
    setCategoryModalOpen(false);
    setCategoryModalError(null);
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
        const result = await client.models.Tag.create({
          tagId,
          label: trimmed,
          categoryId: categoryInput ?? undefined,
        });
        const created = result?.data ?? null;
        if (created) {
          setTags((prev) => sortTags([...prev, created]));
        }
      } else if (activeTag) {
        const result = await client.models.Tag.update({
          tagId: activeTag.tagId,
          label: trimmed,
          categoryId: categoryInput ?? undefined,
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

  const handleSaveCategory = async () => {
    const trimmed = categoryLabelInput.trim();
    if (!trimmed) {
      setCategoryModalError("Category label is required.");
      return;
    }

    try {
      setSaving(true);
      setCategoryModalError(null);
      if (categoryModalMode === "create") {
        const categoryId = crypto.randomUUID();
        const result = await client.models.Category.create({
          categoryId,
          label: trimmed,
        });
        const created = result?.data ?? null;
        if (created) {
          setCategories((prev) => sortCategories([...prev, created]));
        }
      } else if (activeCategory) {
        const result = await client.models.Category.update({
          categoryId: activeCategory.categoryId,
          label: trimmed,
        });
        const updated = result?.data ?? null;
        if (updated) {
          setCategories((prev) =>
            prev.map((item) =>
              item.categoryId === updated.categoryId ? updated : item,
            ),
          );
        }
      }
      setCategoryModalOpen(false);
    } catch (err) {
      setCategoryModalError(
        err instanceof Error ? err.message : "Failed to save category",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!activeCategory) return;
    try {
      setSaving(true);
      setCategoryModalError(null);
      await client.models.Category.delete({ categoryId: activeCategory.categoryId });
      setCategories((prev) =>
        prev.filter((item) => item.categoryId !== activeCategory.categoryId),
      );
      setTags((prev) =>
        prev.map((tag) =>
          tag.categoryId === activeCategory.categoryId
            ? { ...tag, categoryId: undefined }
            : tag,
        ),
      );
      setCategoryModalOpen(false);
    } catch (err) {
      setCategoryModalError(
        err instanceof Error ? err.message : "Failed to delete category",
      );
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
        <div>
          <div className="tags-grid tags-grid--categories">
            {sortedCategories.map((category) => (
              <Card key={category.categoryId} className="tag-card" size="small">
                <button
                  type="button"
                  className="tag-card__label"
                  onClick={() => openEditCategoryModal(category)}
                  aria-label={`Edit ${category.label ?? "category"}`}
                >
                  {category.label}
                </button>
              </Card>
            ))}
            <button
              type="button"
              className="tag-card tag-card--new"
              onClick={openCreateCategoryModal}
            >
              + Category
            </button>
          </div>
          {sortedCategories.map((category) => {
            const group = tagsByCategory.get(category.categoryId) ?? [];
            if (!group.length) return null;
            return (
              <div key={category.categoryId} className="tags-group">
                <div className="tags-group__title">{category.label}</div>
                <div className="tags-grid">
                  {group.map((tag) => (
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
                </div>
              </div>
            );
          })}
          {(tagsByCategory.get(null) ?? []).length ? (
            <div className="tags-group">
              <div className="tags-group__title">Uncategorized</div>
              <div className="tags-grid">
                {(tagsByCategory.get(null) ?? []).map((tag) => (
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
              </div>
            </div>
          ) : null}
          <div className="tags-grid">
            <button
              type="button"
              className="tag-card tag-card--new"
              onClick={openCreateModal}
            >
              + Tag
            </button>
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
            Category
          </label>
          <Select
            id="tag-category-select"
            value={categoryInput ?? undefined}
            allowClear
            placeholder="Uncategorized"
            options={sortedCategories.map((category) => ({
              value: category.categoryId,
              label: category.label ?? "Untitled",
            }))}
            onChange={(value) => setCategoryInput(value ?? null)}
          />
          {modalError ? (
            <Alert type="error" message={modalError} showIcon style={{ marginTop: 12 }} />
          ) : null}
        </div>
      </Modal>
      <Modal
        open={categoryModalOpen}
        onCancel={closeCategoryModal}
        title={categoryModalMode === "create" ? "Create Category" : "Edit Category"}
        footer={
          categoryModalMode === "edit"
            ? [
                <Button
                  key="delete"
                  danger
                  onClick={handleDeleteCategory}
                  disabled={saving}
                >
                  Delete
                </Button>,
                <Button key="cancel" onClick={closeCategoryModal} disabled={saving}>
                  Cancel
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  onClick={handleSaveCategory}
                  loading={saving}
                >
                  Save
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={closeCategoryModal} disabled={saving}>
                  Cancel
                </Button>,
                <Button
                  key="create"
                  type="primary"
                  onClick={handleSaveCategory}
                  loading={saving}
                >
                  Create
                </Button>,
              ]
        }
      >
        <div className="tags-modal">
          <label className="tags-modal__label" htmlFor="category-label-input">
            Category label
          </label>
          <Input
            id="category-label-input"
            value={categoryLabelInput}
            onChange={(event) => setCategoryLabelInput(event.target.value)}
            placeholder="Enter category label"
          />
          {categoryModalError ? (
            <Alert
              type="error"
              message={categoryModalError}
              showIcon
              style={{ marginTop: 12 }}
            />
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
