import { useState } from 'react';
import { KeyRound, Pencil, Plus, UserX } from 'lucide-react';

import { api, can, session } from '@/lib/api';
import type { Role, Staff as StaffUser } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  EmptyState, ErrorNote, IfAllowed, PageHeader, Pager, Spinner, ToastStack,
  useAsync, useDebounced, useToasts,
} from '@/components/Ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const LIMIT = 25;

interface Draft {
  id?: number;
  name: string;
  email: string;
  phone: string;
  role_id: number | '';
  password: string;
  is_active: boolean;
}

export function Staff() {
  const { toasts, push, dismiss } = useToasts();
  const me = session.user();
  const writable = can('staff.write');

  const [search, setSearch] = useState('');
  const query = useDebounced(search);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [resetting, setResetting] = useState<StaffUser | null>(null);
  const [deactivating, setDeactivating] = useState<StaffUser | null>(null);
  const [saving, setSaving] = useState(false);

  const roles = useAsync(() => (can('roles.read') ? api.roles() : Promise.resolve([])), []);
  const { data, loading, error, reload } = useAsync(
    () => api.staff({ q: query, limit: LIMIT, offset }),
    [query, offset],
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || draft.role_id === '') return;
    setSaving(true);
    try {
      if (draft.id) {
        await api.updateStaff(draft.id, {
          name: draft.name,
          email: draft.email,
          phone: draft.phone || null,
          role_id: draft.role_id,
          is_active: draft.is_active,
        });
      } else {
        await api.createStaff({
          name: draft.name,
          email: draft.email,
          phone: draft.phone || null,
          role_id: draft.role_id,
          password: draft.password,
          is_active: draft.is_active,
        });
      }
      push('Staff account saved.');
      setDraft(null);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    if (!deactivating) return;
    try {
      const result = await api.deactivateStaff(deactivating.id);
      push(result.message);
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setDeactivating(null);
    }
  };

  const roleOptions: Role[] = roles.data ?? [];

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Who can sign in, and what each of them can do. A role decides the permissions."
        actions={
          <IfAllowed permission="staff.write">
            <button
              type="button"
              className="a-btn a-btn--primary"
              onClick={() =>
                setDraft({ name: '', email: '', phone: '', role_id: '', password: '', is_active: true })
              }
            >
              <Plus size={15} aria-hidden /> Add someone
            </button>
          </IfAllowed>
        }
      />

      <div className="a-toolbar" style={{ marginBottom: 16 }}>
        <input
          className="a-input"
          type="search"
          placeholder="Name or email"
          aria-label="Search staff"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOffset(0);
          }}
          style={{ minWidth: 240 }}
        />
      </div>

      {error && <ErrorNote error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading staff" />}
      {data && data.items.length === 0 && <EmptyState title="No staff match." body="Try a different search." />}

      {data && data.items.length > 0 && (
        <div className="a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Last signed in</th>
                  <th scope="col">Status</th>
                  {writable && <th scope="col"><span className="nk-sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {data.items.map((person) => {
                  const isMe = person.id === me?.id;
                  return (
                    <tr key={person.id}>
                      <td>
                        {person.name}
                        {isMe && <span className="a-badge a-badge--ghost" style={{ marginLeft: 8 }}>You</span>}
                      </td>
                      <td>{person.email}</td>
                      <td>{person.role.name}</td>
                      <td>{person.last_login_at ? formatDateTime(person.last_login_at) : 'Never'}</td>
                      <td>
                        <span className={`a-badge ${person.is_active ? 'a-badge--ok' : 'a-badge--warn'}`}>
                          {person.is_active ? 'Active' : 'Deactivated'}
                        </span>
                        {person.must_change_password && (
                          <span className="a-badge a-badge--amber" style={{ marginLeft: 6 }} title="Must set their own password at next sign-in">
                            Reset pending
                          </span>
                        )}
                      </td>
                      {writable && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="a-btn a-btn--ghost"
                            onClick={() =>
                              setDraft({
                                id: person.id,
                                name: person.name,
                                email: person.email,
                                phone: person.phone ?? '',
                                role_id: person.role.id,
                                password: '',
                                is_active: person.is_active,
                              })
                            }
                          >
                            <Pencil size={13} aria-hidden /> Edit
                          </button>
                          <button
                            type="button"
                            className="a-btn a-btn--ghost"
                            style={{ marginLeft: 6 }}
                            onClick={() => setResetting(person)}
                          >
                            <KeyRound size={13} aria-hidden /> Reset
                          </button>
                          {/* Your own account is excluded: deactivating it
                              would sign you out with no way back in. */}
                          {person.is_active && !isMe && (
                            <button
                              type="button"
                              className="a-btn a-btn--ghost"
                              style={{ marginLeft: 6 }}
                              aria-label={`Deactivate ${person.name}`}
                              onClick={() => setDeactivating(person)}
                            >
                              <UserX size={13} aria-hidden />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
        </div>
      )}

      {draft && (
        <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <form className="a-dialog" onSubmit={save}>
            <h2>{draft.id ? 'Edit staff account' : 'Add someone'}</h2>

            <label className="a-form-field">
              <span>Name</span>
              <input className="a-input" required autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>

            <label className="a-form-field">
              <span>Email</span>
              <input className="a-input" type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              <span className="a-form-hint">This is what they sign in with.</span>
            </label>

            <label className="a-form-field">
              <span>Phone</span>
              <input className="a-input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </label>

            <label className="a-form-field">
              <span>Role</span>
              <select
                className="a-select"
                required
                value={draft.role_id}
                disabled={draft.id === me?.id}
                onChange={(e) => setDraft({ ...draft, role_id: Number(e.target.value) })}
              >
                <option value="">Choose a role</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              {draft.id === me?.id ? (
                <span className="a-form-hint">You cannot change your own role. Ask another Super Admin.</span>
              ) : (
                <span className="a-form-hint">The role is what decides every permission.</span>
              )}
            </label>

            {!draft.id && (
              <label className="a-form-field">
                <span>Temporary password</span>
                <input
                  className="a-input"
                  type="text"
                  required
                  minLength={10}
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
                <span className="a-form-hint">
                  At least ten characters. They are made to choose their own the first time they sign in.
                </span>
              </label>
            )}

            {draft.id !== me?.id && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} />
                Can sign in
              </label>
            )}

            <div className="a-dialog__actions">
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setDraft(null)}>Cancel</button>
              <button type="submit" className="a-btn a-btn--primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {resetting && (
        <ResetDialog
          person={resetting}
          onClose={() => setResetting(null)}
          onDone={(message) => {
            push(message);
            setResetting(null);
            reload();
          }}
          onError={(message) => push(message, 'error')}
        />
      )}

      {deactivating && (
        <ConfirmDialog
          title={`Deactivate ${deactivating.name}?`}
          body="They can no longer sign in. The account is kept so the audit trail still shows who did what."
          confirmLabel="Deactivate"
          destructive
          onConfirm={deactivate}
          onCancel={() => setDeactivating(null)}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function ResetDialog({
  person, onClose, onDone, onError,
}: {
  person: StaffUser;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.resetStaffPassword(person.id, password);
      onDone(result.message);
    } catch (err) {
      onError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="a-dialog-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="a-dialog" onSubmit={submit}>
        <h2>Reset the password for {person.name}</h2>
        <p className="a-sub">
          Give them this password over a channel you trust. They are made to choose their own the
          next time they sign in.
        </p>
        <label className="a-form-field">
          <span>Temporary password</span>
          <input
            className="a-input"
            type="text"
            required
            minLength={10}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="a-form-hint">At least ten characters, mixing letters, digits and punctuation.</span>
        </label>
        <div className="a-dialog__actions">
          <button type="button" className="a-btn a-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="a-btn a-btn--primary" disabled={busy}>
            {busy ? 'Resetting…' : 'Reset it'}
          </button>
        </div>
      </form>
    </div>
  );
}
