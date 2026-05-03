/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/'],
  transform: {}
};

export default config;
