import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';

import { api, session } from '@/lib/api';
import { landingRoute } from '@/lib/nav';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.login(email.trim(), password);
      session.set(result.access_token, result.user);
      // Sent to the first screen the role can actually open, not a hardcoded
      // "/" - an Order Manager landing on a dashboard they cannot read would
      // meet a permission wall on sign-in.
      navigate(result.user.must_change_password ? '/change-password' : landingRoute(), {
        replace: true,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="a-login">
      <form className="a-login__card" onSubmit={submit}>
        <h1 className="a-h1" style={{ marginBottom: 4 }}>
          Nivisa
        </h1>
        <p className="a-sub" style={{ marginBottom: 24 }}>
          Sign in to the staff dashboard.
        </p>

        {error && (
          <div className="a-error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <label className="a-login__field">
          <span>Email</span>
          <span className="a-login__input-wrap">
            <Mail size={16} className="a-login__icon" aria-hidden />
            <input
              className="a-input"
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </span>
        </label>

        <label className="a-login__field">
          <span>Password</span>
          <span className="a-login__input-wrap">
            <Lock size={16} className="a-login__icon" aria-hidden />
            <input
              className="a-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="a-link-btn a-login__reveal"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        <button type="submit" className="a-btn a-btn--primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? (
            <>
              <Loader2 size={15} className="a-spin" aria-hidden /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </div>
  );
}
