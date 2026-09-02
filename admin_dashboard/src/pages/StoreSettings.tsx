import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { Setting } from '@/lib/api';
import { ErrorNote, PageHeader, Spinner, ToastStack, useAsync, useToasts } from '@/components/Ui';

/**
 * Settings are stored as JSON blobs, so the form is generated from whatever
 * keys a setting actually holds. Adding a field on the backend makes it
 * editable here with no frontend change - and nothing has to be kept in sync
 * between the two.
 */
export function StoreSettings() {
  const { toasts, push, dismiss } = useToasts();
  const { data, loading, error, reload } = useAsync(() => api.settings(), []);
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.map((setting: Setting) => [setting.key, { ...setting.value }])));
  }, [data]);

  if (loading && !data) return <Spinner label="Loading settings" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const save = async (key: string) => {
    setSavingKey(key);
    try {
      await api.updateSetting(key, drafts[key]);
      push('Setting saved.');
      reload();
    } catch (err) {
      push((err as Error).message, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const update = (settingKey: string, field: string, value: unknown) =>
    setDrafts((current) => ({ ...current, [settingKey]: { ...current[settingKey], [field]: value } }));

  return (
    <>
      <PageHeader
        title="Store settings"
        subtitle="Details staff can change without a deployment. Secrets and connection strings stay in the environment."
      />

      <div style={{ display: 'grid', gap: 20 }}>
        {(data ?? []).map((setting) => {
          const draft = drafts[setting.key] ?? {};
          return (
            <section key={setting.key} className="a-card" style={{ padding: 20 }}>
              <h2 className="a-h2">{setting.label || setting.key}</h2>
              <div className="a-form-grid-2" style={{ marginTop: 14 }}>
                {Object.entries(draft).map(([field, value]) => (
                  <label key={field} className="a-form-field">
                    <span>{humanise(field)}</span>
                    {typeof value === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => update(setting.key, field, e.target.checked)}
                        style={{ width: 18, height: 18 }}
                      />
                    ) : typeof value === 'number' ? (
                      <input
                        className="a-input"
                        type="number"
                        value={value}
                        onChange={(e) => update(setting.key, field, Number(e.target.value))}
                      />
                    ) : (
                      <input
                        className="a-input"
                        value={String(value ?? '')}
                        onChange={(e) => update(setting.key, field, e.target.value)}
                      />
                    )}
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="a-btn a-btn--primary"
                style={{ marginTop: 16 }}
                disabled={savingKey === setting.key}
                onClick={() => save(setting.key)}
              >
                {savingKey === setting.key ? 'Saving…' : 'Save'}
              </button>
            </section>
          );
        })}
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function humanise(field: string): string {
  return field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
