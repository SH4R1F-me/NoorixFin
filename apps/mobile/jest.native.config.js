module.exports = {
  preset: 'jest-expo',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.native.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|lucide-react-native|react-native-svg))',
  ],
  collectCoverageFrom: [
    'src/components/ScreenPrimitives.tsx',
    'app/sign-in.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 65,
      lines: 70,
      statements: 70,
    },
  },
};
