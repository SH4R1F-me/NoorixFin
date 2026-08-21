import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/**', '.expo/**'],
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
      // React Compiler's experimental purity rules do not understand
      // Reanimated SharedValue worklets or the native Animated ref wrapper.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      '@typescript-eslint/array-type': 'off',
      'import/first': 'off',
      'import/no-named-as-default-member': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['SafeAreaView'],
              message: 'Use react-native-safe-area-context so inset handling works on every device.',
            },
          ],
        },
      ],
    },
  },
]);
