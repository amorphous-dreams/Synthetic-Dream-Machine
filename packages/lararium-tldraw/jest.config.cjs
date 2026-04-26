/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true, tsconfig: { module: "NodeNext", moduleResolution: "NodeNext" } }],
  },
};
