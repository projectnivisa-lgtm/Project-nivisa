import { useState } from 'react';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';

import { api, can } from '@/lib/api';
import type { PermissionGroup, Role } from '@/lib/api';
import {
  ErrorNote, PageHeader, Spinner, ToastStack, useAsync, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Draft {
  id?: number;
  name: string;
  description: string;
  permissions: Set<string>;
  isSystem: boolean;
  isSuperAdmin: boolean;
}

export function Roles() {
  const { toasts, push, dismiss } = useToasts();
  const writable = can('roles.write');

  const loaded = useAsync(
    async () => {
      const [roles, catalogue] = await Promise.all([api.roles(), api.permissionCatalogue()]);
      return { roles, catalogue };
    },
    [],
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  if (loaded.loading && !loaded.data) return <Spinner label="Loading roles" />;
  if (loaded.error) return <ErrorNote error={loaded.error} onRetry={loaded.reload} />;

  const roles: Role[] = loaded.data?.roles ?? [];
  const catalogue: PermissionGroup[] = loaded.data?.catalogue ?? [];
  const allKeys = catalogue.flatMap((group) => group.permissions.map((p) => p.key));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    const payload = {
      name: draft.name,
      description: draft.description || null,
      permissions: [...draft.permissions],
    };
    try {
      if (draft.id) await api.updateRole(draft.id, payload);
      else await api.createRole(payload);
      push('Role saved.');
      setDraft(null);
      loaded.reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const result = await api.deleteRole(deleting.id);
      push(result.message);
      loaded.reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  const openEditor = (role?: Role) =>
    setDraft(
      role
        ? {
            id: role.id,
            name: role.name,
            description: role.description ?? '',
            permissions: new Set(role.permissions.includes('*') ? allKeys : role.permissions),
            isSystem: role.is_system,
            isSuperAdmin: role.permissions.includes('*'),
          }
        : { name: '', description: '', permissions: new Set<string>(), isSystem: false, isSuperAdmin: false },
    );

  const toggle = (key: string) =>
    setDraft((current) => {
      if (!current) return current;
      const next = new Set(current.permissions);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...current, permissions: next };
    });

  const toggleGroup = (group: PermissionGroup, on: boolean) =>
    setDraft((current) => {
      if (!current) return current;
      const next = new Set(current.permissions);
      for (const permission of group.permissions) {
        on ? next.add(permission.key) : next.delete(permission.key);
      }
      return { ...current, permissions: next };
    });

  return (
    <>
      <PageHeader
        title="Roles and permissions"
        subtitle="A role is a set of permissions. Everyone on the staff has exactly one."
        actions={
          writable && (
            <button type="button" className="a-btn a-btn--primary" onClick={() => openEditor()}>
              <Plus size={15} aria-hidden /> New role
            </button>
          )
        }
      />

      <div style={{ display: 'grid', gap: 14 }}>
        {roles.map((role) => {
          const isSuperAdmin = role.permissions.includes('*');
          return (
            <section key={role.id} className="a-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h2 className="a-h2" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {role.name}
                    {role.is_system && (
                      <span className="a-badge a-badge--ghost" title="Ships with the product">Built in</span>
                    )}
                    {isSuperAdmin && <span className="a-badge a-badge--purple">Full access</span>}
                  </h2>
                  {role.description && (
                    <p className="a-sub" style={{ margin: '4px 0 0' }}>{role.description}</p>
                  )}
                  <p className="a-sub" style={{ margin: '8px 0 0', fontSize: 12 }}>
                    {isSuperAdmin ? 'Every permission' : `${role.permissions.length} permission(s)`}
                    {' · '}
                    {role.staff_count} staff member{role.staff_count === 1 ? '' : 's'}
                  </p>
                </div>
                {writable && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="a-btn a-btn--ghost"
                      // The super-admin role is the recovery path for every
                      // other mistake on this screen. The API refuses to edit
                      // it, so the button is not offered.
                      disabled={isSuperAdmin}
                      title={isSuperAdmin ? 'Full access cannot be edited' : undefined}
                      onClick={() => openEditor(role)}
                    >
                      {isSuperAdmin ? <Lock size={13} aria-hidden /> : <Pencil size={13} aria-hidden />}
                      {isSuperAdmin ? ' Locked' : ' Edit'}
                    </button>
                    {!role.is_system && (
                      <button
                        type="button"
                        className="a-btn a-btn--ghost"
                        aria-label={`Delete ${role.name}`}
                        onClick={() => setDeleting(role)}
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {!isSuperAdmin && role.permissions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
                  {role.permissions.map((key) => (
                    <code
                      key={key}
                      style={{
                        fontSize: 11, padding: '2px 7px', borderRadius: 4,
                        background: 'var(--surface-2, #f6f4f1)',
                      }}
                    >
                      {key}
                    </code>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {draft && (
        <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <form className="a-dialog a-dialog--wide" onSubmit={save}>
            <h2>{draft.id ? `Edit ${draft.name}` : 'New role'}</h2>

            <label className="a-form-field">
              <span>Name</span>
              <input className="a-input" required autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>

            <label className="a-form-field">
              <span>What this role is for</span>
              <input
                className="a-input"
                value={draft.description}
                placeholder="Picks and packs orders. No access to pricing."
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            <p className="a-sub" style={{ margin: '16px 0 8px' }}>
              {draft.permissions.size} of {allKeys.length} permissions selected.
            </p>

            <div style={{ display: 'grid', gap: 16, maxHeight: '46vh', overflowY: 'auto', paddingRight: 6 }}>
              {catalogue.map((group) => {
                const groupKeys = group.permissions.map((p) => p.key);
                const allOn = groupKeys.every((key) => draft.permissions.has(key));
                return (
                  <fieldset key={group.key} style={{ border: '1px solid var(--border, #e5e0da)', borderRadius: 8, padding: 14 }}>
                    <legend style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 6px' }}>
                      <strong style={{ fontSize: 13 }}>{group.label}</strong>
                      <button
                        type="button"
                        className="a-link-btn"
                        style={{ fontSize: 12 }}
                        onClick={() => toggleGroup(group, !allOn)}
                      >
                        {allOn ? 'Clear all' : 'Select all'}
                      </button>
                    </legend>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.key}
                          style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}
                        >
                          <input
                            type="checkbox"
                            checked={draft.permissions.has(permission.key)}
                            onChange={() => toggle(permission.key)}
                            style={{ marginTop: 3 }}
                          />
                          <span>
                            <strong style={{ fontWeight: 500 }}>{permission.label}</strong>
                            <br />
                            {/* The description matters more than the key:
                                whoever assigns a role needs to know what it
                                lets someone do, not what it is called. */}
                            <span className="a-sub" style={{ fontSize: 12 }}>{permission.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>

            <div className="a-dialog__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" className="a-btn a-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save the role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body={
            deleting.staff_count > 0
              ? `${deleting.staff_count} staff member(s) still have this role. Move them to another role first — this will be refused otherwise.`
              : 'Nobody holds this role, so nothing changes for anyone.'
          }
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
