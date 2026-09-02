import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, session } from '@/lib/api';
import { landingRoute } from '@/lib/nav';
import { PageHeader } from '@/components/Ui';

export function ChangePassword() {
  const navigate = useNavigate();
  const user = session.user();
  const forced = user?.must_change_password ?? false;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Checked here as well as by the field types, because a mistyped
    // confirmation is the one error the server genuinely cannot detect.
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      // The cached user still says the change is outstanding; refreshing it
      // is what lets the route guard release.
      const refreshed = await api.me();
      session.setUser(refreshed);
      navigate(landingRoute(), { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 460 }}>
      <PageHeader
        title={forced ? 'Choose your own password' : 'Change your password'}
        subtitle={
          forced
            ? 'Your password was set by an administrator. Pick one only you know before you continue.'
            : 'At least ten characters, with a mix of letters, digits and punctuation.'
        }
      />

      <form className="a-card" style={{ padding: 20 }} onSubmit={submit}>
        {error && (
          <div className="a-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <label className="a-form-field">
          <span>Current password</span>
          <input
            className="a-input"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>

        <label className="a-form-field">
          <span>New password</span>
          <input
            className="a-input"
            type="password"
            autoComplete="new-password"
            minLength={10}
            required
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <span className="a-form-hint">Ten characters or more.</span>
        </label>

        <label className="a-form-field">
          <span>Confirm new password</span>
          <input
            className="a-input"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        <button type="submit" className="a-btn a-btn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </div>
  );
}
