import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook for @noorixfin/ui (audit gap E3).
 *
 * The web app's UI is covered only by 20 Playwright specs, which exercise
 * pages rather than components — so a button's disabled state or an input's
 * error state has no test at all. Stories are where those live: each one is a
 * state rendered in isolation, which is both the documentation and the thing
 * an accessibility scan can be pointed at.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  // Storybook phones home by default. On a product whose landing page
  // advertises zero trackers, shipping a dev tool that reports usage to a third
  // party is the kind of inconsistency that is easy to miss and hard to defend.
  core: {
    disableTelemetry: true,
  },
};

export default config;
