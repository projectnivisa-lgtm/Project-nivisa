import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { CategoryNode } from '@/lib/api';
import {
  EmptyState, ErrorNote, IfAllowed, PageHeader, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Editing {
  id?: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  position: number;
  is_active: boolean;
}

const blank = (parent_id: number | null = null): Editing => ({
  parent_id, name: '', slug: '', description: '', image_url: '', position: 0, is_active: true,
});

export function Categories() {
  const { toasts, push, dismiss } = useToasts();
  const { data, loading, error, reload } = useAsync(() => api.categories(), []);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<CategoryNode | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const writable = can('taxonomy.write');

  const parentOptions = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    const walk = (nodes: CategoryNode[], depth: number) => {
      for (const node of nodes) {
        out.push({ id: node.id, label: `${'— '.repeat(depth)}${node.name}` });
        walk(node.children, depth + 1);
      }
    };
    walk(data ?? [], 0);
    return out;
  }, [data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const payload = {
      name: editing.name,
      slug: editing.slug || undefined,
      parent_id: editing.parent_id,
      description: editing.description || null,
      image_url: editing.image_url || null,
      position: editing.position,
      is_active: editing.is_active,
    };
    try {
      if (editing.id) await api.updateCategory(editing.id, payload);
      else await api.createCategory(payload);
      push('Category saved.');
      setEditing(null);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const result = await api.deleteCategory(deleting.id);
      push(result.message);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  const toggle = (id: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.id);
    return (
      <div key={node.id}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', paddingLeft: 12 + depth * 22,
            borderBottom: '1px solid var(--border, #e5e0da)',
            opacity: node.is_active ? 1 : 0.55,
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="a-link-btn"
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
              onClick={() => toggle(node.id)}
            >
              {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </button>
          ) : (
            <span style={{ width: 15 }} aria-hidden />
          )}

          <span style={{ flex: 1, fontWeight: depth === 0 ? 600 : 400 }}>
            {node.name}
            {!node.is_active && <span className="a-badge a-badge--ghost" style={{ marginLeft: 8 }}>Hidden</span>}
          </span>

          <span className="a-sub" style={{ fontSize: 12 }}>
            {node.product_count} product{node.product_count === 1 ? '' : 's'}
          </span>

          {writable && (
            <>
              <button
                type="button"
                className="a-btn a-btn--ghost"
                onClick={() => setEditing({ ...node, slug: node.slug, description: node.description ?? '', image_url: node.image_url ?? '' })}
              >
                <Pencil size={13} aria-hidden /> Edit
              </button>
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setEditing(blank(node.id))}>
                <Plus size={13} aria-hidden /> Sub
              </button>
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setDeleting(node)}>
                <Trash2 size={13} aria-hidden />
              </button>
            </>
          )}
        </div>
        {!isCollapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Hierarchical. A product sits on one category, and browsing a parent includes everything beneath it."
        actions={
          <IfAllowed permission="taxonomy.write">
            <button type="button" className="a-btn a-btn--primary" onClick={() => setEditing(blank())}>
              <Plus size={15} aria-hidden /> New category
            </button>
          </IfAllowed>
        }
      />

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading categories" />}

      {data && data.length === 0 && (
        <EmptyState title="No categories yet." body="Start with a top level such as Seating or Tables." />
      )}

      {data && data.length > 0 && (
        <div className="a-table-card">{data.map((node) => renderNode(node, 0))}</div>
      )}

      {editing && (
        <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <form className="a-dialog" onSubmit={save}>
            <h2>{editing.id ? 'Edit category' : 'New category'}</h2>

            <label className="a-form-field">
              <span>Name</span>
              <input className="a-input" required autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>

            <label className="a-form-field">
              <span>Parent</span>
              <select
                className="a-select"
                value={editing.parent_id ?? ''}
                onChange={(e) => setEditing({ ...editing, parent_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Top level</option>
                {parentOptions
                  // A category cannot be its own parent; deeper cycles are
                  // caught by the server, which can see the whole tree.
                  .filter((option) => option.id !== editing.id)
                  .map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
              </select>
            </label>

            <label className="a-form-field">
              <span>URL slug</span>
              <input
                className="a-input"
                placeholder="Generated from the name"
                value={editing.slug}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
              />
            </label>

            <label className="a-form-field">
              <span>Description</span>
              <textarea className="a-input" rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </label>

            <label className="a-form-field">
              <span>Image URL</span>
              <input className="a-input" value={editing.image_url} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
            </label>

            <div className="a-form-grid-2">
              <label className="a-form-field">
                <span>Position</span>
                <input
                  className="a-input" type="number"
                  value={editing.position}
                  onChange={(e) => setEditing({ ...editing, position: Number(e.target.value) })}
                />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginTop: 24 }}>
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                />
                Visible in the shop
              </label>
            </div>

            <div className="a-dialog__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="a-btn a-btn--primary">Save</button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body="Categories holding products or sub-categories cannot be deleted. Hide it instead if you only want it out of the shop."
          confirmLabel="Delete it"
          destructive
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
