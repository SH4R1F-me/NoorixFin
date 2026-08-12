import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';
import { Skeleton, SkeletonText } from './Skeleton';
import { Table } from './Table';

const meta: Meta = { title: 'Display/Overview', parameters: { layout: 'padded' } };
export default meta;
type Story = StoryObj;

export const Cards: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}>
      <Card title="This month" subtitle="1–31 August">
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>৳ 42,500 spent of ৳ 60,000</p>
      </Card>
      <Card title="Groceries" subtitle="Budget" action={<Badge tone="warning">92%</Badge>} interactive>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>৳ 9,200 of ৳ 10,000</p>
      </Card>
    </div>
  ),
};

/**
 * Ledger tones carry an `srLabel`, because colour alone is not a signal
 * (Blueprint §5.5). Turn on a screen reader and the red badge reads
 * "expense ৳ 1,200" rather than a number with no direction.
 */
export const Badges: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Badge>Neutral</Badge>
      <Badge tone="success">Posted</Badge>
      <Badge tone="warning">Pending</Badge>
      <Badge tone="danger">Failed</Badge>
      <Badge tone="income" srLabel="income">
        ৳ 30,000
      </Badge>
      <Badge tone="expense" srLabel="expense">
        ৳ 1,200
      </Badge>
      <Badge tone="transfer" srLabel="transfer">
        ৳ 5,000
      </Badge>
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon="🧾"
      title="No transactions yet"
      body="Add your first one and it will show up here, with its running balance."
      action={<Button>Add a transaction</Button>}
    />
  ),
};

export const Loading: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}>
      <Skeleton height="2rem" width="40%" />
      <SkeletonText lines={3} />
    </div>
  ),
};

interface Row {
  id: string;
  date: string;
  payee: string;
  amount: string;
  kind: 'income' | 'expense';
}

const rows: Row[] = [
  { id: '1', date: '08 Aug', payee: 'Salary', amount: '৳ 30,000', kind: 'income' },
  { id: '2', date: '07 Aug', payee: 'Mess rent', amount: '৳ 4,500', kind: 'expense' },
  { id: '3', date: '06 Aug', payee: 'Bazar', amount: '৳ 1,240', kind: 'expense' },
];

export const DataTable: Story = {
  render: () => (
    <Table<Row>
      caption="Recent transactions"
      rows={rows}
      rowKey={(row) => row.id}
      columns={[
        { key: 'date', header: 'Date', render: (row) => row.date },
        { key: 'payee', header: 'Payee', render: (row) => row.payee },
        {
          key: 'amount',
          header: 'Amount',
          numeric: true,
          render: (row) => (
            <Badge tone={row.kind} srLabel={row.kind}>
              {row.amount}
            </Badge>
          ),
        },
      ]}
    />
  ),
};

/**
 * Open this and press Tab repeatedly: focus wraps inside the dialog and never
 * reaches the page behind it. Press Escape and focus returns to the button
 * that opened it. Cancel is focused first — for a destructive action the
 * reflexive Enter must be the safe one.
 */
export const DestructiveConfirm: Story = {
  render: function DestructiveConfirmStory() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>
          Delete workspace
        </Button>
        <ConfirmDialog
          open={open}
          destructive
          title="Delete this workspace?"
          body="Every account, transaction and budget in it is removed. This cannot be undone."
          confirmLabel="Delete permanently"
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};
