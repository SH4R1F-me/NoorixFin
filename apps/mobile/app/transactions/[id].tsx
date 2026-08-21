import { useCallback, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { apiFetch } from '../../src/lib/api';
import { useWorkspace } from '../../src/lib/WorkspaceContext';
import { confirmHaptic } from '../../src/lib/haptics';
import { Button, Card, Field, Notice, Screen, primitiveStyles } from '../../src/components/ScreenPrimitives';
import { useTranslation } from 'react-i18next';

type Attachment = { id: string; original_name: string; content_type: string; size_bytes: number; created_at: string };
type Posting = { id: string; ledger_account_id: string; debit_minor: string; credit_minor: string; currency_code: string };
type Transaction = { id: string; entry_type: string; occurred_at: string; local_date: string; payee?: string | null; note?: string | null; status: string; postings?: Posting[]; attachments?: Attachment[]; tags?: string[]; reversed?: boolean };
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

function acceptedType(file: File): (typeof ACCEPTED)[number] | null {
  if (ACCEPTED.includes(file.type as (typeof ACCEPTED)[number])) return file.type as (typeof ACCEPTED)[number];
  const ext = file.extension.toLowerCase();
  return ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.pdf' ? 'application/pdf' : null;
}

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workspaceId } = useWorkspace();
  const { t } = useTranslation();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!workspaceId || !id) return;
    try {
      const result = await apiFetch(`/workspaces/${workspaceId}/transactions/${id}`);
      setTransaction(result); setTags((result.tags ?? []).join(', ')); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load transaction'); }
  }, [id, workspaceId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const saveTags = async () => {
    if (!workspaceId || !id) return;
    setBusy(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/transactions/${id}/tags`, { method: 'PUT', body: { tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) } });
      await load(); confirmHaptic();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save tags'); }
    finally { setBusy(false); }
  };
  const reverse = async () => {
    if (!workspaceId || !id) return;
    setBusy(true);
    try { await apiFetch(`/workspaces/${workspaceId}/transactions/${id}/reverse`, { method: 'POST' }); await load(); confirmHaptic(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not reverse transaction'); }
    finally { setBusy(false); }
  };
  const uploadReceipt = async () => {
    if (!workspaceId || !id) return;
    const picked = await File.pickFileAsync({ mimeTypes: [...ACCEPTED] });
    if (picked.canceled) return;
    const file = picked.result;
    const contentType = acceptedType(file);
    if (!contentType || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG, PNG, WebP, or PDF no larger than 5 MB.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/workspaces/${workspaceId}/transactions/${id}/attachments`, { method: 'POST', body: { idempotency_key: randomUUID(), filename: file.name, content_type: contentType, data_base64: await file.base64() } });
      await load(); confirmHaptic();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload receipt'); }
    finally { setBusy(false); }
  };
  const openReceipt = async (attachment: Attachment) => {
    if (!workspaceId || !id) return;
    const result = await apiFetch(`/workspaces/${workspaceId}/transactions/${id}/attachments/${attachment.id}`);
    await Linking.openURL(result.url);
  };
  const deleteReceipt = async (attachment: Attachment) => {
    if (!workspaceId || !id) return;
    await apiFetch(`/workspaces/${workspaceId}/transactions/${id}/attachments/${attachment.id}`, { method: 'DELETE' });
    await load(); confirmHaptic();
  };

  return (
    <Screen title={t('mobile.management.transactionDetail')}>
      {error ? <Notice error>{error}</Notice> : null}
      {transaction ? (
        <>
          <Card>
            <View style={primitiveStyles.between}><Text style={primitiveStyles.cardTitle}>{transaction.payee ?? transaction.entry_type}</Text><Text style={primitiveStyles.secondary}>{transaction.status}</Text></View>
            <Text style={primitiveStyles.secondary}>{transaction.local_date} · {transaction.entry_type}</Text>
            {transaction.note ? <Text style={primitiveStyles.secondary}>{transaction.note}</Text> : null}
            {(transaction.postings ?? []).map((posting) => <Text key={posting.id} style={primitiveStyles.secondary}>{posting.currency_code}: debit {posting.debit_minor} · credit {posting.credit_minor}</Text>)}
          </Card>
          <Field label={t('mobile.management.tags')} value={tags} onChangeText={setTags} autoCapitalize="none" />
          <Button label={t('mobile.management.saveTags')} onPress={() => void saveTags()} busy={busy} />
          <Text style={primitiveStyles.section}>{t('mobile.management.receipts')}</Text>
          {(transaction.attachments ?? []).map((attachment) => (
            <Card key={attachment.id}>
              <Text style={primitiveStyles.cardTitle}>{attachment.original_name}</Text>
              <Text style={primitiveStyles.secondary}>{attachment.content_type} · {attachment.size_bytes} bytes</Text>
              <Button label={t('mobile.management.open', { name: attachment.original_name })} onPress={() => void openReceipt(attachment)} />
              <Button label={t('mobile.management.deleteNamed', { name: attachment.original_name })} destructive onPress={() => Alert.alert(t('mobile.management.delete'), attachment.original_name, [{ text: t('mobile.common.cancel'), style: 'cancel' }, { text: t('mobile.management.delete'), style: 'destructive', onPress: () => void deleteReceipt(attachment) }])} />
            </Card>
          ))}
          <Button label={t('mobile.management.attachReceipt')} onPress={() => void uploadReceipt()} busy={busy} />
          {!transaction.reversed && transaction.status === 'POSTED' ? <Button label={t('mobile.management.reverseTransaction')} destructive onPress={() => Alert.alert(t('mobile.management.reverseTransaction'), undefined, [{ text: t('mobile.common.cancel'), style: 'cancel' }, { text: t('mobile.management.reverseTransaction'), style: 'destructive', onPress: () => void reverse() }])} /> : <Notice>{t('mobile.management.alreadyReversed')}</Notice>}
        </>
      ) : null}
    </Screen>
  );
}
