import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { majorStringToMinorUnits } from '@noorixfin/money';
import { apiFetch } from '../src/lib/api';
import { useWorkspace } from '../src/lib/WorkspaceContext';
import { confirmHaptic } from '../src/lib/haptics';
import { Button, Card, Empty, Field, Notice, Screen, primitiveStyles } from '../src/components/ScreenPrimitives';
import { useTranslation } from 'react-i18next';

type Goal = { id: string; name: string; target_minor: number; current_minor: number | null; currency_code: string; target_date: string | null; status: string };

export default function GoalsScreen() {
  const { workspaceId, workspaceCurrency } = useWorkspace();
  const { t } = useTranslation();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const result = await apiFetch(`/workspaces/${workspaceId}/goals`);
      setGoals(result.goals ?? []);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load goals'); }
  }, [workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const create = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/goals`, {
        method: 'POST',
        body: { name: name.trim(), target_minor: String(majorStringToMinorUnits(target, workspaceCurrency)), currency_code: workspaceCurrency, ...(date ? { target_date: date } : {}) },
      });
      setName(''); setTarget(''); setDate('');
      await load(); confirmHaptic();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create goal'); }
    finally { setBusy(false); }
  };

  const mutate = async (goal: Goal, action: 'achieve' | 'delete') => {
    if (!workspaceId) return;
    if (action === 'delete') {
      await apiFetch(`/workspaces/${workspaceId}/goals/${goal.id}`, { method: 'DELETE' });
    } else {
      await apiFetch(`/workspaces/${workspaceId}/goals/${goal.id}`, { method: 'PATCH', body: { status: 'ACHIEVED' } });
    }
    await load(); confirmHaptic();
  };

  return (
    <Screen title={t('mobile.management.goals')}>
      <Field label={t('mobile.management.goalName')} value={name} onChangeText={setName} />
      <Field label={t('mobile.management.target', { currency: workspaceCurrency })} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
      <Field label={t('mobile.management.targetDate')} value={date} onChangeText={setDate} autoCapitalize="none" />
      <Button label={t('mobile.management.createGoal')} onPress={() => void create()} busy={busy} disabled={!name.trim() || !target.trim()} />
      {error ? <Notice error>{error}</Notice> : null}
      {goals.length === 0 ? <Empty>{t('mobile.management.noGoals')}</Empty> : goals.map((goal) => (
        <Card key={goal.id}>
          <View style={primitiveStyles.between}>
            <View style={{ flex: 1 }}>
              <Text style={primitiveStyles.cardTitle}>{goal.name}</Text>
              <Text style={primitiveStyles.secondary}>{goal.current_minor ?? 'Not linked'} / {goal.target_minor} {goal.currency_code} · {goal.status}</Text>
            </View>
          </View>
          {goal.status === 'ACTIVE' ? <Button label={t('mobile.management.markAchieved', { name: goal.name })} onPress={() => void mutate(goal, 'achieve')} /> : null}
          <Button label={t('mobile.management.deleteNamed', { name: goal.name })} destructive onPress={() => Alert.alert(t('mobile.management.delete'), goal.name, [{ text: t('mobile.common.cancel'), style: 'cancel' }, { text: t('mobile.management.delete'), style: 'destructive', onPress: () => void mutate(goal, 'delete') }])} />
        </Card>
      ))}
    </Screen>
  );
}
