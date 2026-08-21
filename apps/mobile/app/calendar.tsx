import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { majorStringToMinorUnits } from '@noorixfin/money';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { confirmHaptic, selectionHaptic } from '../src/lib/haptics';
import { Button, Card, Choice, Empty, Field, Notice, Screen, primitiveStyles } from '../src/components/ScreenPrimitives';
import { useTranslation } from 'react-i18next';

type EventType = 'BILL' | 'INCOME' | 'GOAL' | 'CUSTOM';
type Event = { id: string; type: EventType; title: string; amount_minor: number | null; currency_code: string; local_date: string; status: string };
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export default function CalendarScreen() {
  const { workspaceId, workspaceCurrency } = useWorkspace();
  const { t } = useTranslation();
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(tomorrow);
  const [type, setType] = useState<EventType>('BILL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!workspaceId) return;
    try { const result = await apiFetch(`/workspaces/${workspaceId}/calendar?days=365`); setEvents(result.events ?? []); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load calendar'); }
  }, [workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const create = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/calendar`, { method: 'POST', body: { type, title: title.trim(), due_date: dueDate, currency_code: workspaceCurrency, reminder_offsets: [1440, 60], ...(amount ? { amount_minor: String(majorStringToMinorUnits(amount, workspaceCurrency)) } : {}) } });
      setTitle(''); setAmount(''); await load(); confirmHaptic();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create event'); }
    finally { setBusy(false); }
  };
  const update = async (event: Event, action: 'paid' | 'delete') => {
    if (!workspaceId) return;
    if (action === 'delete') await apiFetch(`/workspaces/${workspaceId}/calendar/${event.id}`, { method: 'DELETE' });
    else await apiFetch(`/workspaces/${workspaceId}/calendar/${event.id}`, { method: 'PATCH', body: { status: 'PAID' } });
    await load(); confirmHaptic();
  };

  return (
    <Screen title={t('mobile.management.calendar')}>
      <Field label={t('mobile.management.eventTitle')} value={title} onChangeText={setTitle} />
      <Choice label={t('mobile.management.eventType')} value={type} options={['BILL', 'INCOME', 'GOAL', 'CUSTOM']} onChange={(value) => { selectionHaptic(); setType(value); }} />
      <Field label={t('mobile.management.amountOptional', { currency: workspaceCurrency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <Field label={t('mobile.management.dueDate')} value={dueDate} onChangeText={setDueDate} autoCapitalize="none" />
      <Button label={t('mobile.management.addEvent')} onPress={() => void create()} busy={busy} disabled={!title.trim() || !dueDate} />
      {error ? <Notice error>{error}</Notice> : null}
      {events.length === 0 ? <Empty>{t('mobile.management.noEvents')}</Empty> : events.map((event) => (
        <Card key={event.id}>
          <View style={primitiveStyles.between}><Text style={primitiveStyles.cardTitle}>{event.title}</Text><Text style={primitiveStyles.secondary}>{event.status}</Text></View>
          <Text style={primitiveStyles.secondary}>{event.type} · {event.local_date}{event.amount_minor === null ? '' : ` · ${event.amount_minor} ${event.currency_code}`}</Text>
          {['UPCOMING', 'DUE', 'OVERDUE'].includes(event.status) ? <Button label={t('mobile.management.markPaid', { name: event.title })} onPress={() => void update(event, 'paid')} /> : null}
          <Button label={t('mobile.management.deleteNamed', { name: event.title })} destructive onPress={() => Alert.alert(t('mobile.management.delete'), event.title, [{ text: t('mobile.common.cancel'), style: 'cancel' }, { text: t('mobile.management.delete'), style: 'destructive', onPress: () => void update(event, 'delete') }])} />
        </Card>
      ))}
    </Screen>
  );
}
