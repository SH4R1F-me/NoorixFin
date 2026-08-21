/**
 * Node-based tests for the offline sync engine.
 *
 * These are deliberately NOT React Native tests — there is no renderer here.
 * The target is the sync engine's logic and SQL, which is where financial data
 * can actually be lost. Native modules are swapped for Node equivalents:
 * `node:sqlite` runs the real schema and the real queries.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^expo-sqlite$': '<rootDir>/src/__tests__/mocks/expo-sqlite.ts',
    '^expo-crypto$': '<rootDir>/src/__tests__/mocks/expo-native.ts',
    '^expo-secure-store$': '<rootDir>/src/__tests__/mocks/expo-native.ts',
    '^expo-local-authentication$': '<rootDir>/src/__tests__/mocks/expo-native.ts',
    '^expo-constants$': '<rootDir>/src/__tests__/mocks/expo-native.ts',
    '^expo-network$': '<rootDir>/src/__tests__/mocks/rn-stub.ts',
    '^react-native$': '<rootDir>/src/__tests__/mocks/rn-stub.ts',
    '^react-native-url-polyfill/auto$': '<rootDir>/src/__tests__/mocks/rn-stub.ts',
    '^@supabase/supabase-js$': '<rootDir>/src/__tests__/mocks/rn-stub.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Inline tsconfig replaces the app's, so jest/node types must be named
        // explicitly or `describe`/`it`/`expect` are unresolved.
        tsconfig: {
          module: 'commonjs',
          strict: false,
          esModuleInterop: true,
          types: ['jest', 'node'],
          skipLibCheck: true,
        },
      },
    ],
  },
};
