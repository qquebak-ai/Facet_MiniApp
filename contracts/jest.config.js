export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true, tsconfig: { module: "ES2022", target: "ES2022", moduleResolution: "bundler", strict: false, esModuleInterop: true, skipLibCheck: true } }],
  },
  testMatch: ["**/tests/**/*.test.ts"],
  testTimeout: 60000,
};
