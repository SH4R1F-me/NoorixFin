import { getNotificationCampaigns, getNotificationDeliveryStats } from '../../../../lib/admin';
import { ErrorState } from '../../ui';

export default async function NotificationDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  const campaignsResult = await getNotificationCampaigns();
  if (!campaignsResult.ok) return <ErrorState error={campaignsResult.error} />;
  const selected =
    campaign && campaignsResult.data.some((row) => row.id === campaign)
      ? campaign
      : campaignsResult.data[0]?.id;
  const statsResult = selected ? await getNotificationDeliveryStats(selected) : null;
  if (statsResult && !statsResult.ok) return <ErrorState error={statsResult.error} />;
  const stats = statsResult?.ok ? statsResult.data : null;
  return (
    <section style={{ maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ color: '#fafaf9', marginBottom: 4 }}>Notification delivery log</h1>
      <p style={{ color: '#a8a29e', fontSize: '.8rem' }}>
        Aggregate outcomes only. Recipient identities and notification bodies remain outside the
        operator aperture.
      </p>
      <form style={{ margin: '1rem 0' }}>
        <label style={{ color: '#a8a29e', fontSize: '.75rem' }}>
          Campaign{' '}
          <select
            name="campaign"
            defaultValue={selected}
            style={{
              marginLeft: 8,
              colorScheme: 'dark',
              background: '#0c0a09',
              color: '#f5f5f4',
              border: '1px solid #44403c',
              borderRadius: 6,
              padding: 8,
            }}
          >
            {campaignsResult.data.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title_en} · {row.status}
              </option>
            ))}
          </select>
        </label>
        <button
          style={{
            marginLeft: 8,
            background: '#f59e0b',
            border: 0,
            borderRadius: 6,
            padding: '8px 12px',
            fontWeight: 800,
          }}
        >
          Inspect
        </button>
      </form>
      {!stats ? (
        <div
          style={{ color: '#78716c', border: '1px dashed #44403c', borderRadius: 10, padding: 32 }}
        >
          No campaigns have been sent.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: '#fbbf24' }}>
            {stats.total} durable recipient notification{stats.total === 1 ? '' : 's'}
          </div>
          {Object.entries(stats.by_channel).map(([channel, outcomes]) => (
            <article
              key={channel}
              style={{
                border: '1px solid #292524',
                borderRadius: 10,
                padding: 14,
                background: '#0c0a09',
              }}
            >
              <strong style={{ color: '#f5f5f4', textTransform: 'uppercase' }}>{channel}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {Object.entries(outcomes).map(([status, count]) => (
                  <span
                    key={status}
                    style={{
                      color:
                        status === 'FAILED'
                          ? '#fb7185'
                          : status === 'DELIVERED'
                            ? '#34d399'
                            : '#d6d3d1',
                      border: '1px solid #44403c',
                      borderRadius: 99,
                      padding: '4px 8px',
                      fontSize: '.75rem',
                    }}
                  >
                    {status}: {count}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
