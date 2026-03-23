// Lightweight ambient types to satisfy TypeScript in test files during CI/type-check.
declare const vi: any;
declare namespace vi {
  type Mock = any;
}
