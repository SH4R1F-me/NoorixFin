import { __resetAll } from '../__tests__/mocks/expo-sqlite';
import { __resetUuid } from '../__tests__/mocks/expo-native';
import { getDb } from '../db';
import { createTransaction, listRecent } from './transactions';

const WS = '11111111-1111-1111-1111-111111111111';

beforeEach(async () => {
  __resetAll();
  __resetUuid();
  await getDb();
});

it('shows the exact optimistic amount and account currency before postings arrive', async () => {
  await createTransaction(WS, {
    type: 'EXPENSE',
    amount: '1234',
    account_id: '22222222-2222-2222-2222-222222222222',
    currency_code: 'SAR',
    payee: 'Market',
  });

  const rows = await listRecent(WS);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    amount_minor: 1234,
    currency_code: 'SAR',
    is_pending: 1,
    payee: 'Market',
  });
});

it('queues only the server contract and keeps local display metadata local', async () => {
  await createTransaction(WS, {
    type: 'INCOME',
    amount: '500',
    account_id: '22222222-2222-2222-2222-222222222222',
    currency_code: 'KWD',
  });

  const db = await getDb();
  const queued = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM _mutation_queue LIMIT 1',
  );
  const payload = JSON.parse(queued!.payload) as Record<string, unknown>;
  expect(payload.amount).toBe('500');
  expect(payload).not.toHaveProperty('currency_code');
});
