import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'Controls/Input',
  component: Input,
  args: { label: 'Email', placeholder: 'name@example.com' },
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {};

export const Required: Story = { args: { required: true } };

export const WithHint: Story = {
  args: { hint: 'We only use this to sign you in.' },
};

/**
 * The error state is the reason this component exists.
 *
 * The red border is not the signal — the message is text, it is wired to the
 * field with `aria-describedby`, and `aria-invalid` marks the state. Inspect
 * the accessibility tree here: the field announces its label, its invalid
 * state and its message together.
 */
export const WithError: Story = {
  args: { error: 'That email is already registered.', defaultValue: 'nope' },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: 'locked@example.com' } };

export const AmountField: Story = {
  args: {
    label: 'Amount',
    // Money is a minor-unit decimal string on the wire (DEC-004), so the input
    // is text with a numeric keypad rather than type="number" — which would
    // let a browser localise the separator and hand back "1,5".
    type: 'text',
    inputMode: 'decimal',
    placeholder: '0.00',
    hint: 'Taka and paisa, e.g. 1250.50',
  },
};
