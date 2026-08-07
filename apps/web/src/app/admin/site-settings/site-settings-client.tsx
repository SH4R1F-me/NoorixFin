'use client';

/**
 * Admin Site Settings — Client UI
 *
 * Logo upload + Donation settings editor.
 * Uses server actions for all mutations.
 */

import { useState, useRef, useTransition } from 'react';
import { Upload, X, Save, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { uploadLogoAction, clearLogoAction, saveDonationOptionAction } from './actions';
import type { DonationOption, PaymentMethod } from '../../../lib/site-settings';

/* ── Shared components ───────────────────────────────── */

function Alert({ type, msg }: { type: 'ok' | 'err'; msg: string }) {
  const color = type === 'ok' ? '#10b981' : '#f87171';
  const Icon = type === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', padding: '0.75rem 1rem', borderRadius: 8, border: `1px solid ${color}22`, background: `${color}11`, color, fontSize: '0.875rem', marginTop: '0.75rem' }}>
      <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      {msg}
    </div>
  );
}

/* ── Logo Section ────────────────────────────────────── */

function LogoSection({ currentLogoUrl }: { currentLogoUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadLogoAction(fd);
      if (res.ok) {
        setMsg({ type: 'ok', text: 'Logo updated! It will appear in the nav on next page load.' });
        setPreview(res.url ?? null);
      } else {
        setMsg({ type: 'err', text: res.error ?? 'Upload failed.' });
      }
    });
  }

  function handleClear() {
    startTransition(async () => {
      const res = await clearLogoAction();
      if (res.ok) {
        setPreview(null);
        setMsg({ type: 'ok', text: 'Logo cleared. The default icon will show.' });
        if (fileRef.current) fileRef.current.value = '';
      } else {
        setMsg({ type: 'err', text: res.error ?? 'Failed to clear.' });
      }
    });
  }

  return (
    <div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fafaf9', marginBottom: '0.25rem' }}>Site Logo</h3>
      <p style={{ fontSize: '0.8125rem', color: '#a09990', marginBottom: '1.25rem' }}>
        PNG, JPG, SVG, or WebP. Max 2 MB. Displayed in the marketing nav bar.
      </p>

      {/* Preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ width: 72, height: 72, borderRadius: 12, border: '1px solid #292524', background: '#0c0a09', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {preview
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={preview} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: '0.75rem', color: '#78716c' }}>No logo</span>
          }
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#a09990' }}>
          {preview ? 'Current logo preview' : 'Using default icon (Wallet symbol)'}
        </div>
      </div>

      <form onSubmit={handleUpload} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          name="logo"
          accept=".png,.jpg,.jpeg,.svg,.webp"
          onChange={handleFile}
          style={{ fontSize: '0.8125rem', color: '#fafaf9' }}
          id="logo-upload"
        />
        <button
          type="submit"
          disabled={pending}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: '#10b981', color: '#0c0a09', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
        >
          <Upload size={15} /> {pending ? 'Uploading…' : 'Upload'}
        </button>
        {preview && (
          <button
            type="button"
            onClick={handleClear}
            disabled={pending}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            <X size={15} /> Clear
          </button>
        )}
      </form>

      {msg && <Alert type={msg.type} msg={msg.text} />}
    </div>
  );
}

/* ── Payment Method Editor ───────────────────────────── */

function PaymentMethodEditor({
  methods,
  onChange,
}: {
  methods: PaymentMethod[];
  onChange: (m: PaymentMethod[]) => void;
}) {
  function update(i: number, field: keyof PaymentMethod, val: string) {
    const next = methods.map((m, idx) => idx === i ? { ...m, [field]: val } : m);
    onChange(next);
  }
  function add() {
    onChange([...methods, { method: 'link', label: '', url: '' }]);
  }
  function remove(i: number) {
    onChange(methods.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      {methods.map((m, i) => (
        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #292524', borderRadius: 8, padding: '0.875rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select
              value={m.method}
              onChange={(e) => update(i, 'method', e.target.value)}
              style={{ fontSize: '0.8125rem', background: '#1c1917', color: '#fafaf9', border: '1px solid #292524', borderRadius: 6, padding: '0.375rem 0.5rem' }}
            >
              <option value="paypal">PayPal</option>
              <option value="bkash">bKash</option>
              <option value="bank">Bank</option>
              <option value="link">Link</option>
            </select>
            <input
              placeholder="Label (e.g. PayPal, bKash)"
              value={m.label}
              onChange={(e) => update(i, 'label', e.target.value)}
              style={{ fontSize: '0.8125rem', background: '#1c1917', color: '#fafaf9', border: '1px solid #292524', borderRadius: 6, padding: '0.375rem 0.5rem' }}
            />
          </div>
          <input
            placeholder="Account number or URL"
            value={m.account || m.url || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (m.method === 'link' || m.method === 'paypal') update(i, 'url', val);
              else update(i, 'account', val);
            }}
            style={{ width: '100%', fontSize: '0.8125rem', background: '#1c1917', color: '#fafaf9', border: '1px solid #292524', borderRadius: 6, padding: '0.375rem 0.5rem', marginBottom: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              placeholder="Note (optional)"
              value={m.note || ''}
              onChange={(e) => update(i, 'note', e.target.value)}
              style={{ flex: 1, fontSize: '0.8125rem', background: '#1c1917', color: '#fafaf9', border: '1px solid #292524', borderRadius: 6, padding: '0.375rem 0.5rem' }}
            />
            <button onClick={() => remove(i)} style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: 'none', borderRadius: 6, padding: '0.375rem 0.5rem', cursor: 'pointer' }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={add}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', background: 'rgba(255,255,255,0.05)', color: '#a09990', border: '1px dashed #292524', borderRadius: 6, fontSize: '0.8125rem', cursor: 'pointer', marginTop: '0.25rem' }}
      >
        <Plus size={14} /> Add payment method
      </button>
    </div>
  );
}

/* ── Donation Section ────────────────────────────────── */

function DonationSection({ option }: { option: DonationOption }) {
  const [title, setTitle] = useState(option.title);
  const [subtitle, setSubtitle] = useState(option.subtitle);
  const [description, setDescription] = useState(option.description);
  const [methods, setMethods] = useState<PaymentMethod[]>(option.payment_methods);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const isPalestine = option.type === 'palestine';
  const accentColor = isPalestine ? '#f87171' : '#10b981';

  function handleSave() {
    const fd = new FormData();
    fd.set('title', title);
    fd.set('subtitle', subtitle);
    fd.set('description', description);
    fd.set('payment_methods', JSON.stringify(methods));
    startTransition(async () => {
      const res = await saveDonationOptionAction(option.type, fd);
      setMsg(res.ok ? { type: 'ok', text: 'Saved! The /support page is updated.' } : { type: 'err', text: res.error ?? 'Save failed.' });
    });
  }

  const inputStyle: React.CSSProperties = { width: '100%', fontSize: '0.875rem', background: '#1c1917', color: '#fafaf9', border: '1px solid #292524', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.75rem', fontFamily: 'inherit' };

  return (
    <div style={{ border: `1px solid ${accentColor}22`, borderRadius: 12, padding: '1.5rem', background: `${accentColor}08` }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fafaf9', marginBottom: '0.25rem' }}>
        {option.icon} {option.type === 'development' ? 'Support Development' : 'Support Palestine'}
      </h3>
      <p style={{ fontSize: '0.75rem', color: '#a09990', marginBottom: '1.25rem' }}>
        Changes are reflected immediately on the public /support page.
      </p>

      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a09990', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />

      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a09990', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Subtitle (tag line)</label>
      <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} style={inputStyle} />

      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a09990', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />

      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a09990', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>Payment Methods</label>
      <PaymentMethodEditor methods={methods} onChange={setMethods} />

      <button
        onClick={handleSave}
        disabled={pending}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', padding: '0.625rem 1.125rem', background: accentColor, color: '#0c0a09', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.7 : 1 }}
      >
        <Save size={15} /> {pending ? 'Saving…' : 'Save Changes'}
      </button>

      {msg && <Alert type={msg.type} msg={msg.text} />}
    </div>
  );
}

/* ── Main export ─────────────────────────────────────── */

export default function SiteSettingsClient({
  currentLogoUrl,
  donationOptions,
}: {
  currentLogoUrl: string | null;
  donationOptions: DonationOption[];
}) {
  const panelStyle: React.CSSProperties = {
    background: '#211e1c',
    border: '1px solid #292524',
    borderRadius: 12,
    padding: '1.5rem',
    marginBottom: '1.5rem',
  };

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={panelStyle}>
        <LogoSection currentLogoUrl={currentLogoUrl} />
      </div>

      <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Donation Settings
      </h2>

      {donationOptions.map((opt) => (
        <div key={opt.type} style={{ marginBottom: '1.5rem' }}>
          <DonationSection option={opt} />
        </div>
      ))}

      {donationOptions.length === 0 && (
        <div style={{ ...panelStyle, textAlign: 'center', color: '#a09990', fontSize: '0.875rem' }}>
          Run migration 00021 to seed donation option rows.
        </div>
      )}
    </div>
  );
}
