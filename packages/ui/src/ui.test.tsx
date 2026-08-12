/**
 * Component tests (audit gap E3).
 *
 * These assert the *wiring*, not the styling. Styling regressions are visible;
 * a label that is not associated with its input, or a dialog that lets focus
 * escape behind it, look completely fine on screen and are the whole reason
 * this package exists rather than another folder of inline styles.
 *
 * Written against the accessibility tree (`getByRole`, `getByLabelText`) rather
 * than class names on purpose: a test that queries `.nx-btn` passes whether or
 * not a screen reader can find the button.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Badge } from './Badge';
import { Table } from './Table';
import { ConfirmDialog } from './ConfirmDialog';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

describe('Button', () => {
  it('keeps a loading button focusable and blocks its click', async () => {
    // `disabled` would remove it from the tab order, destroying focus for a
    // keyboard user mid-submit. `aria-disabled` keeps focus and still tells
    // assistive tech the control is unavailable.
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', false);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');

    button.focus();
    expect(document.activeElement).toBe(button);

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not shrink when it starts loading', () => {
    // The label stays in the DOM so the button keeps its width; swapping it
    // for a spinner resizes the control under the user's cursor.
    const { rerender } = render(<Button>Save changes</Button>);
    expect(screen.getByRole('button').textContent).toContain('Save changes');

    rerender(<Button loading>Save changes</Button>);
    expect(screen.getByRole('button').textContent).toContain('Save changes');
  });

  it('still calls onClick when idle', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('respects a genuinely disabled button', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Go
      </Button>,
    );
    expect(screen.getByRole('button')).toHaveProperty('disabled', true);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Input', () => {
  it('associates the label so the field is findable by its name', () => {
    render(<Input label="Email" />);
    // Fails if the label is a bare <span>, which looks identical on screen.
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('wires the hint to the field with aria-describedby', () => {
    render(<Input label="Email" hint="We only use this to sign you in." />);
    const input = screen.getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toContain('sign you in');
  });

  it('marks the invalid state in the tree, not just in colour', () => {
    render(<Input label="Email" error="Already registered." />);
    const input = screen.getByLabelText('Email');

    // A red border is colour alone — §5.5 forbids that as the only signal.
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const message = screen.getByRole('alert');
    expect(message.textContent).toContain('Already registered.');
    expect(input.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('shows the error instead of the hint when both are given', () => {
    render(<Input label="Email" hint="hint text" error="error text" />);
    expect(screen.queryByText('hint text')).toBeNull();
    expect(screen.getByText('error text')).toBeTruthy();
  });

  it('gives each instance its own ids', () => {
    render(
      <>
        <Input label="First" hint="a" />
        <Input label="Second" hint="b" />
      </>,
    );
    // Colliding ids would point both fields' aria-describedby at one message.
    const first = screen.getByLabelText('First').getAttribute('aria-describedby');
    const second = screen.getByLabelText('Second').getAttribute('aria-describedby');
    expect(first).not.toBe(second);
  });
});

describe('Badge', () => {
  it('adds a screen-reader label so meaning is not colour alone', () => {
    render(
      <Badge tone="expense" srLabel="expense">
        ৳ 1,200
      </Badge>,
    );
    // A sighted user reads "expense" from the red; everyone else needs the word.
    expect(screen.getByText(/expense/).textContent).toContain('expense');
    expect(screen.getByText(/1,200/)).toBeTruthy();
  });
});

describe('Table', () => {
  const rows = [{ id: '1', payee: 'Salary', amount: '30,000' }];

  it('captions the table so it can be identified by screen reader', () => {
    render(
      <Table
        caption="Recent transactions"
        rows={rows}
        rowKey={(r) => r.id}
        columns={[
          { key: 'payee', header: 'Payee', render: (r) => r.payee },
          { key: 'amount', header: 'Amount', numeric: true, render: (r) => r.amount },
        ]}
      />,
    );
    expect(screen.getByRole('table', { name: 'Recent transactions' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('renders the empty state instead of an empty grid', () => {
    render(
      <Table
        caption="Recent transactions"
        rows={[]}
        rowKey={(r: { id: string }) => r.id}
        columns={[]}
        empty={<EmptyState title="No transactions yet" />}
      />,
    );
    // A blank table is indistinguishable from a broken one.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('No transactions yet')).toBeTruthy();
  });
});

describe('ConfirmDialog', () => {
  function Harness({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <ConfirmDialog
          open={open}
          destructive
          title="Delete this workspace?"
          body="This cannot be undone."
          confirmLabel="Delete permanently"
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
        />
      </>
    );
  }

  it('focuses Cancel first, so a reflexive Enter is the safe option', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(document.activeElement?.textContent).toContain('Cancel');
  });

  it('closes on Escape and returns focus to whatever opened it', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Without this, a keyboard user is dropped at the top of the document
    // after every confirmation.
    expect(document.activeElement).toBe(opener);
  });

  it('confirms only when the confirm button is pressed', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await userEvent.click(screen.getByRole('button', { name: /Delete permanently/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('is labelled and described for assistive technology', async () => {
    render(<Harness onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Delete this workspace?' });
    const describedBy = dialog.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)?.textContent).toContain('cannot be undone');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('renders nothing at all when closed', () => {
    render(<Harness onConfirm={vi.fn()} />);
    // Not merely hidden: a dialog left in the DOM keeps its controls tabbable.
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
