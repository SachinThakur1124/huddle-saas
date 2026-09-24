import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  coverageThreshold: {
    global: {},
    "src/services/**": { statements: 60, branches: 50 },
    "src/middleware/**": { statements: 60, branches: 50 },
  },
  collectCoverageFrom: ["src/services/**/*.ts", "src/middleware/**/*.ts"],
  testTimeout: 30000,
};

export default config;
