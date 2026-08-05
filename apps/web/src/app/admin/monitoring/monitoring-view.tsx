'use client';

/**
 * Live monitoring feed.
 *
 * Seeded server-side with the most recent page, then appended to over SSE from
 * /admin/monitoring/stream. The server render is what makes this useful on
 * arrival — a feed that starts empty and fills over the next 3 seconds looks
 * broken during the exact incident you opened it for.
 *
 * Filtering is client-side over the buffer so it stays instant and does not
 * re-query on every keystroke; the buffer is capped so a busy system cannot
 * grow this tab's memory without bound.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Pause, Play, Search, Trash2 } from 'lucide-react';
import type { SystemEvent } from '../../../lib/admin';
import { Badge, EmptyState, LEVEL_COLOR, T, formatTime, s } from '../ui';

/** Newest N kept in memory. Beyond this, older entries fall off the tail. */
const MAX_BUFFER = 500;

const LEVELS = ['ALL', 'FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as const;

export default function MonitoringView({
  initialEvents,
  initialError,
}: {
  initialEvents: SystemEvent[];
  initialError: string | null;
}) {
  const [events, setEvents] = useState<SystemEvent[]>(initialEvents);
  const [level, setLevel] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [live, setLive] = useState(true);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'error'>('connecting');
  const [expanded, setExpanded] = useState<number | null>(null);

  // The cursor must survive re-renders without triggering them, and must not be
  // a dependency of the effect below — otherwise every batch would tear down
  // and rebuild the EventSource.
  const cursorRef = useRef<number>(initialEvents[0]?.id ?? 0);

  useEffect(() => {
    if (!live) return;

    const source = new EventSource(
      `/admin/monitoring/stream?afterId=${cursorRef.current}`,
    );

    source.onopen = () => setConnection('live');

    source.onmessage = (message) => {
      setConnection('live');
      try {
        const payload = JSON.parse(message.data) as {
          events: SystemEvent[];
          cursor: number;
        };
        if (payload.cursor > cursorRef.current) cursorRef.current = payload.cursor;
        if (payload.events.length === 0) return;

        setEvents((current) => {
          // The upstream cursor should prevent duplicates, but a reconnect can
          // replay the boundary — dedupe by id rather than trusting it.
          const seen = new Set(current.map((event) => event.id));
          const fresh = payload.events.filter((event) => !seen.has(event.id));
          if (fresh.length === 0) return current;
          return [...fresh.reverse(), ...current].slice(0, MAX_BUFFER);
        });
      } catch {
        // A malformed frame is not worth killing the feed over.
      }
    };

    source.onerror = () => setConnection('error');

    return () => source.close();
  }, [live]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return events.filter((event) => {
      if (level !== 'ALL' && event.level !== level) return false;
      if (!term) return true;
      return (
        event.event_code.toLowerCase().includes(term) ||
        event.message.toLowerCase().includes(term) ||
        (event.route ?? '').toLowerCase().includes(term) ||
        (event.request_id ?? '').toLowerCase().includes(term)
      );
    });
  }, [events, level, query]);

  const connectionTone =
    connection === 'live' ? T.ok : connection === 'error' ? T.error : T.warn;

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.title}>Monitoring</h1>
        <p style={s.subtitle}>
          Live operational feed — errors, security signals and slow requests. Request bodies and
          query strings are never logged.
        </p>
      </div>

      <div style={{ ...s.panel, marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
            alignItems: 'center',
            padding: '0.875rem 1.25rem',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: connectionTone,
              fontSize: '0.75rem',
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: connectionTone,
                display: 'inline-block',
              }}
            />
            {connection === 'live' ? 'LIVE' : connection === 'error' ? 'DISCONNECTED' : 'CONNECTING'}
          </span>

          <div style={{ display: 'flex', gap: 2 }}>
            {LEVELS.map((option) => (
              <button
                key={option}
                onClick={() => setLevel(option)}
                style={{
                  ...s.btnGhost,
                  padding: '0.3rem 0.6rem',
                  ...(level === option
                    ? { background: T.accentSoft, color: T.accent, borderColor: T.accent }
                    : {}),
                }}
              >
                {option}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 10, top: 10, color: T.textFaint }}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by code, message, route or request id"
              style={{ ...s.input, width: '100%', paddingLeft: '2rem' }}
            />
          </div>

          <button onClick={() => setLive(!live)} style={s.btnGhost}>
            {live ? <Pause size={13} /> : <Play size={13} />}
            {live ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={() => {
              setEvents([]);
              setExpanded(null);
            }}
            style={s.btnGhost}
            title="Clear this view — does not delete anything from the database"
          >
            <Trash2 size={13} />
            Clear view
          </button>
        </div>
      </div>

      <div style={s.panel}>
        <div style={s.panelHeader}>
          <span style={s.panelTitle}>
            <Activity size={16} color={T.accent} />
            Events
          </span>
          <span style={{ color: T.textFaint, fontSize: '0.75rem' }}>
            {filtered.length} shown · {events.length} buffered
            {events.length >= MAX_BUFFER && ' (capped)'}
          </span>
        </div>

        {initialError ? (
          <div style={{ padding: '1.25rem' }}>
            <div style={{ color: T.error, fontSize: '0.8125rem' }}>
              <strong>Could not load the initial page of events.</strong>
              <div style={{ ...s.mono, marginTop: 6, color: '#fca5a5' }}>{initialError}</div>
              <div style={{ color: T.textFaint, marginTop: 6 }}>
                The live feed may still connect below.
              </div>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            text={
              events.length === 0
                ? 'No events recorded yet. Errors, 401/403/429 responses and slow requests will appear here as they happen.'
                : 'No events match the current filter.'
            }
          />
        ) : (
          <div
            style={s.tableWrap}
            // Scrolls horizontally, so it must be reachable by keyboard.
            tabIndex={0}
            role="region"
            aria-label="System events table, scrollable"
          >
            <table style={s.table}>
              <thead>
                <tr>
                  <th scope="col" style={s.th}>Level</th>
                  <th scope="col" style={s.th}>Time</th>
                  <th scope="col" style={s.th}>Code</th>
                  <th scope="col" style={s.th}>Message</th>
                  <th scope="col" style={s.th}>Route</th>
                  <th scope="col" style={s.th}>Status</th>
                  <th scope="col" style={s.th}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => setExpanded(expanded === event.id ? null : event.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={s.td}>
                      <Badge text={event.level} color={LEVEL_COLOR[event.level] ?? T.textDim} />
                    </td>
                    <td style={{ ...s.td, ...s.mono, whiteSpace: 'nowrap' }}>
                      {formatTime(event.created_at)}
                    </td>
                    <td style={{ ...s.td, color: T.text, fontWeight: 500 }}>{event.event_code}</td>
                    <td style={{ ...s.td, maxWidth: 420 }}>
                      {event.message}
                      {expanded === event.id && (
                        <pre
                          /*
                            A scrollable region needs to be focusable, or a
                            keyboard user can see that there is more JSON and
                            has no way to reach it — WCAG 2.1.1. `maxHeight`
                            with `overflow: auto` is what makes this scrollable,
                            so the two belong together.

                            role="region" + a label so it is announced as
                            something enterable rather than as an unnamed stop
                            in the tab order.
                          */
                          tabIndex={0}
                          role="region"
                          aria-label={`Event detail for ${event.message}`}
                          style={{
                            ...s.mono,
                            marginTop: 8,
                            padding: '0.6rem',
                            background: 'rgba(12,10,9,0.7)',
                            borderRadius: '0.5rem',
                            color: T.textDim,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: 280,
                            overflow: 'auto',
                          }}
                        >
                          {JSON.stringify(
                            {
                              request_id: event.request_id,
                              actor_id: event.actor_id,
                              source: event.source,
                              metadata: event.metadata,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      )}
                    </td>
                    <td style={{ ...s.td, ...s.mono }}>{event.route ?? '—'}</td>
                    <td style={{ ...s.td, ...s.mono }}>{event.status_code ?? '—'}</td>
                    <td style={{ ...s.td, ...s.mono }}>
                      {event.latency_ms ? `${event.latency_ms}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
