/**
 * Minimal stand-in for https://deno.land/std/testing/asserts.ts so the
 * edge-function test suites (written as Deno.test) can run under vitest.
 * Aliased in vitest.config.ts.
 */
export function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

export function assertEquals(actual: unknown, expected: unknown, message?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(message ?? `assertEquals failed\n  actual:   ${a}\n  expected: ${e}`);
}

export function assertExists(value: unknown, message?: string): asserts value {
  if (value === null || value === undefined) throw new Error(message ?? "assertExists failed");
}

export function assertStringIncludes(actual: string, expected: string, message?: string): void {
  if (!actual.includes(expected)) throw new Error(message ?? `expected string to include "${expected}"`);
}

export function assertThrows(fn: () => unknown, message?: string): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message ?? "expected function to throw");
}
