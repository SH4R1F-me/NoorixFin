import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Controls/Button',
  component: Button,
  args: { children: 'Save changes' },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Ghost: Story = { args: { variant: 'ghost' } };

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete workspace' },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg">
        Large
      </Button>
    </div>
  ),
};

/**
 * The state worth reviewing. The label stays in the DOM while loading, so the
 * button does not change width underneath the cursor — compare the two below
 * and note they are the same size.
 */
export const Loading: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <Button {...args}>Save changes</Button>
      <Button {...args} loading>
        Save changes
      </Button>
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true } };

export const Block: Story = {
  args: { block: true },
  parameters: { layout: 'padded' },
};

export const WithIcon: Story = {
  args: { leadingIcon: <span aria-hidden="true">＋</span>, children: 'Add transaction' },
};
