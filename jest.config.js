/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest",{}],
  },
  setupFiles: [],
  moduleNameMapper: {
    // Handle module aliases if needed
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};