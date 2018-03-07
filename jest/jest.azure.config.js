module.exports = {
    testEnvironment: 'node',
    transform: {
      '.(ts|tsx)': '<rootDir>/preprocessor.js'
    },
    moduleFileExtensions: [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json'
    ],
    testRegex: '(/__tests__/).*(azure/).*(spec|test).(ts|js)x?$',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
      'src/**/*.{ts,tsx,js,jsx}',
      '!src/**/*.d.ts',
    ],
  };
  