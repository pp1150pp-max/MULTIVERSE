// Tiny assertion helper for the test scripts in this folder (run with `npm run test`).
let fails = 0;

export function ok(cond: unknown, what: string): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${what}`);
  if (!cond) fails++;
}

/** Prints the result and exits with code 1 if anything failed (so `npm run test` fails too). */
export function finish(name: string): never {
  console.log(fails ? `\n${name}: ${fails} FAILED\n` : `\n${name}: all passed\n`);
  process.exit(fails ? 1 : 0);
}
