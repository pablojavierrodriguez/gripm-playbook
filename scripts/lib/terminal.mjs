/**
 * scripts/lib/terminal.mjs
 *
 * Shared ANSI terminal styling and header utilities.
 */

export const isColorSupported = Boolean(
  !('NO_COLOR' in process.env) &&
    (process.env.FORCE_COLOR === '1' ||
      Boolean(process.env.FORCE_COLOR) ||
      (process.stdout?.isTTY && process.env.TERM !== 'dumb')),
);

export const c = {
  bold: (s) => (isColorSupported ? `\x1b[1m${s}\x1b[22m` : s),
  dim: (s) => (isColorSupported ? `\x1b[2m${s}\x1b[22m` : s),
  cyan: (s) => (isColorSupported ? `\x1b[36m${s}\x1b[39m` : s),
  green: (s) => (isColorSupported ? `\x1b[32m${s}\x1b[39m` : s),
  yellow: (s) => (isColorSupported ? `\x1b[33m${s}\x1b[39m` : s),
  red: (s) => (isColorSupported ? `\x1b[31m${s}\x1b[39m` : s),
};

export function printHeader(title) {
  console.log(`\n  ${c.bold('gripm')} ${c.dim('·')} ${title}\n`);
}
