'use client';

import { useState } from 'react';
import {
  Globe, Clock, DollarSign, Calendar, Moon, Sun, Shield,
  User, Bell, Save, Check, ChevronRight, Trash2, LogOut,
} from 'lucide-react';

const TIMEZONES = ['Asia/Dhaka', 'Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
const CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'JPY'];
const WEEK_STARTS = ['Saturday', 'Sunday', 'Monday'];

export default function SettingsPage() {
  const [locale, setLocale] = useState('bn');
  const [timezone, setTimezone] = useState('Asia/Dhaka');
  const [currency, setCurrency] = useState('BDT');
  const [weekStart, setWeekStart] = useState('Saturday');
  const [theme, setTheme] = useState('dark');
  const [saved, setSaved] = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const s: Record<string, React.CSSProperties> = {
    hdr: { marginBottom: '2rem' },
    title: { fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0 },
    sub: { fontSize: '0.8125rem', color: '#64748b', margin: 0, marginTop: 2 },
    sections: { display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 720 },
    section: { background: 'rgba(30,41,59,0.4)', border: '1px solid #1e293b', borderRadius: '1rem', overflow: 'hidden' },
    sectionHeader: { padding: '1rem 1.25rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '0.625rem' },
    sectionTitle: { fontSize: '0.9375rem', fontWeight: 700, color: '#f8fafc' },
    sectionIcon: { color: '#10b981' },
    row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(30,41,59,0.5)', gap: '1rem' },
    rowLabel: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
    rowTitle: { fontSize: '0.875rem', fontWeight: 500, color: '#f8fafc' },
    rowDesc: { fontSize: '0.75rem', color: '#64748b' },
    select: { padding: '0.5rem 0.75rem', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.8125rem', fontFamily: 'inherit', outline: 'none', minWidth: 160 },
    toggle: { display: 'flex', background: 'rgba(15,23,42,0.6)', border: '1px solid #334155', borderRadius: '0.5rem', overflow: 'hidden' },
    toggleBtn: { padding: '0.375rem 0.75rem', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: '0.375rem' },
    toggleActive: { background: 'rgba(16,185,129,0.15)', color: '#10b981' },
    saveBar: { display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', maxWidth: 720 },
    saveBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', background: saved ? '#059669' : 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: '0.75rem', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', transition: 'all 200ms' },
    dangerSection: { background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '1rem', overflow: 'hidden' },
    dangerBtn: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem', color: '#ef4444', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'inherit' },
  };

  return (
    <div>
      <div style={s.hdr}><h1 style={s.title}>সেটিংস</h1><p style={s.sub}>Settings</p></div>

      <div style={s.sections}>
        {/* Preferences */}
        <div style={s.section}>
          <div style={s.sectionHeader}><Globe size={18} style={s.sectionIcon} /><span style={s.sectionTitle}>Preferences</span></div>
          <div style={s.row}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Language / ভাষা</span><span style={s.rowDesc}>Choose your display language</span></div>
            <div style={s.toggle}>
              <button onClick={() => setLocale('bn')} style={{ ...s.toggleBtn, ...(locale === 'bn' ? s.toggleActive : {}) }}>বাংলা</button>
              <button onClick={() => setLocale('en')} style={{ ...s.toggleBtn, ...(locale === 'en' ? s.toggleActive : {}) }}>English</button>
            </div>
          </div>
          <div style={s.row}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Timezone</span><span style={s.rowDesc}>Used for transaction dates and reports</span></div>
            <select value={timezone} onChange={e => setTimezone(e.target.value)} style={s.select}>
              {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
            </select>
          </div>
          <div style={s.row}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Default Currency</span><span style={s.rowDesc}>Primary currency for new accounts</span></div>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={s.select}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Week Starts On</span><span style={s.rowDesc}>Affects budget periods and calendar</span></div>
            <select value={weekStart} onChange={e => setWeekStart(e.target.value)} style={s.select}>
              {WEEK_STARTS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
        </div>

        {/* Appearance */}
        <div style={s.section}>
          <div style={s.sectionHeader}><Moon size={18} style={s.sectionIcon} /><span style={s.sectionTitle}>Appearance</span></div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Theme</span><span style={s.rowDesc}>Toggle between dark and light mode</span></div>
            <div style={s.toggle}>
              <button onClick={() => setTheme('dark')} style={{ ...s.toggleBtn, ...(theme === 'dark' ? s.toggleActive : {}) }}><Moon size={14} />Dark</button>
              <button onClick={() => setTheme('light')} style={{ ...s.toggleBtn, ...(theme === 'light' ? s.toggleActive : {}) }}><Sun size={14} />Light</button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div style={s.section}>
          <div style={s.sectionHeader}><Bell size={18} style={s.sectionIcon} /><span style={s.sectionTitle}>Notifications</span></div>
          <div style={s.row}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Bill Reminders</span><span style={s.rowDesc}>Get notified before bills are due</span></div>
            <div style={s.toggle}>
              <button style={{ ...s.toggleBtn, ...s.toggleActive }}>On</button>
              <button style={s.toggleBtn}>Off</button>
            </div>
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Budget Alerts</span><span style={s.rowDesc}>Alert when nearing budget limits</span></div>
            <div style={s.toggle}>
              <button style={{ ...s.toggleBtn, ...s.toggleActive }}>On</button>
              <button style={s.toggleBtn}>Off</button>
            </div>
          </div>
        </div>

        {/* Security */}
        <div style={s.section}>
          <div style={s.sectionHeader}><Shield size={18} style={s.sectionIcon} /><span style={s.sectionTitle}>Security</span></div>
          <div style={s.row}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Change Password</span><span style={s.rowDesc}>Update your account password</span></div>
            <ChevronRight size={16} style={{ color: '#64748b' }} />
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Active Sessions</span><span style={s.rowDesc}>Manage logged-in devices</span></div>
            <ChevronRight size={16} style={{ color: '#64748b' }} />
          </div>
        </div>

        {/* Danger Zone */}
        <div style={s.dangerSection}>
          <div style={{ ...s.sectionHeader, borderBottom: '1px solid rgba(239,68,68,0.15)' }}><Trash2 size={18} style={{ color: '#ef4444' }} /><span style={{ ...s.sectionTitle, color: '#ef4444' }}>Danger Zone</span></div>
          <div style={s.row}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Sign Out All Devices</span><span style={s.rowDesc}>End all active sessions</span></div>
            <button style={s.dangerBtn}><LogOut size={14} />Sign Out All</button>
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <div style={s.rowLabel}><span style={s.rowTitle}>Delete Account</span><span style={s.rowDesc}>Permanently delete your account and all data</span></div>
            <button style={s.dangerBtn}><Trash2 size={14} />Delete</button>
          </div>
        </div>
      </div>

      <div style={s.saveBar}>
        <button onClick={handleSave} style={s.saveBtn}>
          {saved ? <><Check size={16} />Saved!</> : <><Save size={16} />Save Changes</>}
        </button>
      </div>
    </div>
  );
}
