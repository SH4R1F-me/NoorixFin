import type { Preview } from '@storybook/react-vite';

// The tokens, then the components. Without the first import every component
// renders unstyled, because every value in ui.css is a var() that resolves to
// nothing — which is exactly the failure mode worth catching in isolation.
import '@noorixfin/design-tokens/tokens.css';
import '../src/ui.css';

const preview: Preview = {
  parameters: {
    // The product is dark-first; a white canvas would misrepresent every
    // component's contrast, which is the property most worth reviewing here.
    backgrounds: {
      options: {
        app: { name: 'App', value: '#0f172a' },
        marketing: { name: 'Marketing', value: '#030712' },
      },
    },
    controls: { expanded: true },
  },
  initialGlobals: {
    backgrounds: { value: 'app' },
  },
};

export default preview;
