'use client';

/**
 * Global settings editor.
 *
 * Settings are declared by migration, so this renders whatever keys exist rather
 * than hardcoding a form — a new setting appears here without a UI change. The
 * three shapes we actually store (`{enabled}`, `{value}`, `{days}`) get proper
 * controls; anything else falls back to a JSON editor rather than being hidden.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, Settings2, Trash2 } from 'lucide-react';
import type { AppSetting } from '../../../lib/admin';
import { Badge, Panel, T, formatTime, s } from '../ui';
import { pruneEvents, saveSettings } from './actions';

type Draft = Record<string, Record<string, unknown>>;

export default function SettingsView({ settings }: { settings: AppSetting[] }) {
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  );
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const dirty = settings.filter(
    (setting) => JSON.stringify(draft[setting.key]) !== JSON.stringify(setting.value),
  );

  function patch(key: string, value: Record<string, unknown>) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (Object.keys(jsonErrors).length > 0) {
      setMessage({ ok: false, text: 'Fix the invalid JSON before saving.' });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const result = await saveSettings(
        dirty.map((setting) => ({ key: setting.key, value: draft[setting.key] })),
      );
      setMessage(
        result.ok
          ? { ok: true, text: `Saved ${dirty.length} setting(s).` }
          : { ok: false, text: result.message },
      );
      if (result.ok) router.refresh();
    });
  }

  const maintenanceOn = Boolean(
    (draft.maintenance_mode as { enabled?: boolean } | undefined)?.enabled,
  );

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.title}>Global Settings</h1>
        <p style={s.subtitle}>
          Platform-wide configuration. Public settings are readable by every signed-in user; private
          ones are operator-only.
        </p>
      </div>

      {message && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.6rem',
            fontSize: '0.8125rem',
            background: message.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: message.ok ? T.ok : T.error,
          }}
        >
          {message.text}
        </div>
      )}

      {maintenanceOn && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.6rem',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.35)',
            color: T.warn,
            fontSize: '0.8125rem',
            display: 'flex',
            gap: '0.6rem',
            alignItems: 'center',
          }}
        >
          <AlertTriangle size={16} />
          Maintenance mode is ON — every signed-in user sees the maintenance banner.
        </div>
      )}

      <Panel title="Settings" icon={<Settings2 size={16} color={T.accent} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {settings.map((setting) => (
            <SettingRow
              key={setting.key}
              setting={setting}
              value={draft[setting.key]}
              error={jsonErrors[setting.key]}
              onChange={(value) => patch(setting.key, value)}
              onJsonError={(error) =>
                setJsonErrors((current) => {
                  const next = { ...current };
                  if (error) next[setting.key] = error;
                  else delete next[setting.key];
                  return next;
                })
              }
            />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1.5rem',
            paddingTop: '1rem',
            borderTop: `1px solid ${T.border}`,
          }}
        >
          <span style={{ color: T.textFaint, fontSize: '0.75rem' }}>
            {dirty.length === 0
              ? 'No unsaved changes.'
              : `${dirty.length} unsaved change(s): ${dirty.map((x) => x.key).join(', ')}`}
          </span>
          <button onClick={save} disabled={pending || dirty.length === 0} style={{ ...s.btn, opacity: dirty.length === 0 ? 0.5 : 1 }}>
            {pending ? <Loader2 size={14} /> : <Check size={14} />}
            Save changes
          </button>
        </div>
      </Panel>

      <div style={{ marginTop: '1.5rem' }}>
        <Panel title="Maintenance operations" icon={<Trash2 size={16} color={T.accent} />}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div>
              <div style={{ color: T.text, fontSize: '0.875rem', fontWeight: 500 }}>
                Prune system events
              </div>
              <div style={{ color: T.textFaint, fontSize: '0.75rem', marginTop: 2 }}>
                Deletes operational events older than the retention window above. Audit events are
                never pruned. No scheduler runs this automatically yet.
              </div>
            </div>
            <button
              onClick={() => {
                if (!confirm('Delete system events past the retention window?')) return;
                startTransition(async () => {
                  const result = await pruneEvents();
                  setMessage(
                    result.ok
                      ? { ok: true, text: 'Prune complete.' }
                      : { ok: false, text: result.message },
                  );
                });
              }}
              disabled={pending}
              style={s.btnGhost}
            >
              Run prune
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SettingRow({
  setting,
  value,
  error,
  onChange,
  onJsonError,
}: {
  setting: AppSetting;
  value: Record<string, unknown>;
  error?: string;
  onChange: (value: Record<string, unknown>) => void;
  onJsonError: (error: string | null) => void;
}) {
  const shape = Object.keys(setting.value);
  const isToggle = shape.length >= 1 && typeof setting.value.enabled === 'boolean';
  const isScalar = shape.length === 1 && typeof setting.value.value === 'string';
  const isNumber = shape.length === 1 && typeof setting.value.days === 'number';

  return (
    <div style={{ borderBottom: `1px solid ${T.borderSoft}`, paddingBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ ...s.mono, color: T.text, fontWeight: 600, fontSize: '0.8125rem' }}>
              {setting.key}
            </span>
            <Badge text={setting.is_public ? 'PUBLIC' : 'PRIVATE'} color={setting.is_public ? T.info : T.textFaint} />
          </div>
          <div style={{ color: T.textFaint, fontSize: '0.75rem', marginTop: 3 }}>
            {setting.description}
          </div>
          <div style={{ color: T.textFaint, fontSize: '0.6875rem', marginTop: 3 }}>
            Last changed {formatTime(setting.updated_at)}
          </div>
        </div>

        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {isToggle && (
            <div style={{ display: 'flex', gap: 2 }}>
              <button
                onClick={() => onChange({ ...value, enabled: true })}
                style={{
                  ...s.btnGhost,
                  ...(value.enabled ? { background: T.accentSoft, color: T.accent, borderColor: T.accent } : {}),
                }}
              >
                Enabled
              </button>
              <button
                onClick={() => onChange({ ...value, enabled: false })}
                style={{
                  ...s.btnGhost,
                  ...(!value.enabled ? { background: T.accentSoft, color: T.accent, borderColor: T.accent } : {}),
                }}
              >
                Disabled
              </button>
            </div>
          )}

          {isToggle && 'message_en' in setting.value && (
            <>
              {/*
                aria-label rather than the placeholder alone. A placeholder is
                not an accessible name — it disappears the moment someone types,
                so a screen-reader user reviewing a filled form hears nothing.
                The setting key is included because this page renders the same
                field shape for several settings, and "Message (English)" on its
                own does not say WHICH setting it belongs to.
              */}
              <input
                value={String(value.message_en ?? '')}
                onChange={(event) => onChange({ ...value, message_en: event.target.value })}
                placeholder="Message (English)"
                aria-label={`${setting.key} — message (English)`}
                style={{ ...s.input, width: '100%' }}
              />
              <input
                value={String(value.message_bn ?? '')}
                onChange={(event) => onChange({ ...value, message_bn: event.target.value })}
                placeholder="বার্তা (বাংলা)"
                aria-label={`${setting.key} — message (Bangla)`}
                style={{ ...s.input, width: '100%' }}
              />
            </>
          )}

          {isScalar && (
            <input
              value={String(value.value ?? '')}
              onChange={(event) => onChange({ value: event.target.value })}
              aria-label={setting.key}
              style={{ ...s.input, width: '100%' }}
            />
          )}

          {isNumber && (
            <input
              type="number"
              min={1}
              value={Number(value.days ?? 30)}
              onChange={(event) => onChange({ days: Number(event.target.value) })}
              aria-label={`${setting.key} — days`}
              style={{ ...s.input, width: '100%' }}
            />
          )}

          {/* Unknown shape: show the raw JSON rather than silently omitting a
              setting the operator came here to change. */}
          {!isToggle && !isScalar && !isNumber && (
            <>
              <textarea
                defaultValue={JSON.stringify(value, null, 2)}
                onChange={(event) => {
                  try {
                    onChange(JSON.parse(event.target.value) as Record<string, unknown>);
                    onJsonError(null);
                  } catch {
                    onJsonError('Invalid JSON');
                  }
                }}
                rows={4}
                aria-label={`${setting.key} — raw JSON value`}
                style={{ ...s.input, ...s.mono, width: '100%', resize: 'vertical' }}
              />
              {error && <span style={{ color: T.error, fontSize: '0.6875rem' }}>{error}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
