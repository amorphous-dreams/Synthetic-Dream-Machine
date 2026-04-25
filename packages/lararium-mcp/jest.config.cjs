/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@lararium/core$": "<rootDir>/../../packages/lararium-core/src/index.ts",
    "^@lararium/node$": "<rootDir>/../../packages/lararium-node/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
        },
      },
    ],
  },
  testMatch: ["<rootDir>/tests/**/*.ts"],
  testTimeout: 15000,
};

module.exports = config;
