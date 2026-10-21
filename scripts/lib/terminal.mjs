/**
 * scripts/lib/terminal.mjs
 *
 * Shared ANSI terminal styling, header utilities and interactive prompts.
 *
 * Every prompt falls back to its default when stdin is not a TTY, so the same
 * code path serves the interactive wizard, `--yes`, pipes and the test suite.
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

/** Reads one line from stdin. Resolves `null` on EOF. */
function readLine() {
  return new Promise((resolve) => {
    const onData = (chunk) => {
      cleanup();
      resolve(chunk.toString().split(/\r?\n/)[0].trim());
    };
    const onEnd = () => {
      cleanup();
      resolve(null);
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
    };
    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
  });
}

function formatChoices(question, choices, defaultValues) {
  const lines = [`\n  ${question}`];
  choices.forEach((option, index) => {
    const marker = defaultValues.includes(option.value) ? '*' : ' ';
    lines.push(`    ${marker}[${index + 1}] ${option.label}`);
  });
  return lines;
}

/** Free text input. Returns `defaultValue` on empty answer or no TTY. */
export async function promptText(question, defaultValue = '') {
  if (!process.stdin.isTTY) return defaultValue;
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  process.stdout.write(`  ${question}${suffix}: `);
  const raw = await readLine();
  return raw === null || raw === '' ? defaultValue : raw;
}

/** Yes/no confirmation, Spanish-friendly (`s`, `si`, `sí` also count). */
export async function promptConfirm(question, defaultValue = false) {
  if (!process.stdin.isTTY) return defaultValue;
  process.stdout.write(`  ${question} [${defaultValue ? 'Y/n' : 'y/N'}] `);
  const raw = await readLine();
  if (raw === null || raw === '') return defaultValue;
  return /^(y|yes|s|si|sí)$/i.test(raw);
}

/** Single choice by number or by value. Re-asks on invalid input. */
export async function promptSelect(question, choices, defaultValue) {
  const defaultIndex = Math.max(0, choices.findIndex((option) => option.value === defaultValue));
  const fallback = choices[defaultIndex].value;
  if (!process.stdin.isTTY) return fallback;

  console.log(formatChoices(question, choices, [fallback]).join('\n'));

  for (;;) {
    process.stdout.write(`  Select option [${defaultIndex + 1}]: `);
    const raw = await readLine();
    if (raw === null || raw === '') return fallback;

    const numeric = Number.parseInt(raw, 10);
    if (String(numeric) === raw && numeric >= 1 && numeric <= choices.length) {
      return choices[numeric - 1].value;
    }
    const byValue = choices.find((option) => option.value === raw || option.label.toLowerCase() === raw.toLowerCase());
    if (byValue) return byValue.value;

    console.log(`  ${c.yellow('▲')} Enter a number between 1 and ${choices.length}.`);
  }
}

/** Multiple choice: `1,3`, literal values, `all` or `none`. Empty repeats the defaults. */
export async function promptMultiSelect(question, choices, defaultValues = []) {
  if (!process.stdin.isTTY) return defaultValues;

  console.log(formatChoices(question, choices, defaultValues).join('\n'));

  for (;;) {
    const hint = defaultValues.length ? defaultValues.join(', ') : 'none';
    process.stdout.write(`  Select options (e.g. 1,3 | all | none) [${hint}]: `);
    const raw = await readLine();
    if (raw === null || raw === '') return [...defaultValues];
    if (/^all$/i.test(raw)) return choices.map((option) => option.value);
    if (/^none$/i.test(raw)) return [];

    const picked = new Set();
    let valid = true;
    for (const token of raw.split(/[,\s]+/).filter(Boolean)) {
      const numeric = Number.parseInt(token, 10);
      if (String(numeric) === token && numeric >= 1 && numeric <= choices.length) {
        picked.add(choices[numeric - 1].value);
        continue;
      }
      if (choices.some((option) => option.value === token)) {
        picked.add(token);
        continue;
      }
      valid = false;
      break;
    }
    if (valid && picked.size) return [...picked];

    console.log(`  ${c.yellow('▲')} Pick numbers between 1 and ${choices.length}, separated by commas.`);
  }
}
