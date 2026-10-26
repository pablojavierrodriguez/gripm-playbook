#!/usr/bin/env node

/**
 * Gripm Playbook Onboarding CLI
 *
 * One wizard that installs the framework and generates the native instruction
 * files of each supported AI harness (Antigravity, Cursor, Claude Code), with
 * the project name, stack and language already resolved.
 *
 * Usage:
 *   node scripts/init.mjs [options]      (or: npx @gripm/playbook init)
 *
 * Options:
 *   --repo <dir>       Target repository (default: cwd)
 *   --source <dir>     Local playbook directory to sync from (bypasses GitHub)
 *   --tag <ref>        Git ref to sync from (default: latest release tag, else main)
 *   --remote <o/r>     Upstream repository (default: pablojavierrodriguez/gripm-playbook)
 *   --stack <name>     Stack pack, repeatable. Skips the stack question.
 *   --harness <name>   antigravity | cursor | claude, repeatable. Skips the harness question.
 *   --name <name>      Project name (default: package.json "name")
 *   --lang <code>      Project language: en | es (default: en)
 *   --board            Configure the Gripm Board (.gripm/config.json)
 *   --no-board         Skip the Gripm Board configuration
 *   --force            Overwrite generated adapter files (CLAUDE.md, .cursor/rules) that already exist.
 *   --yes, -y          Non-interactive: accept every default, no prompts
 *   --list-harnesses   List the supported harnesses and exit
 *   --help, -h         Show usage
 *
 * Exit codes: 0 ok · 1 the install left protected or orphaned files · 2 fatal
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { c, printHeader, promptText, promptConfirm, promptSelect, promptMultiSelect } from './lib/terminal.mjs';
import { HARNESS_CHOICES, LANGUAGE_LABELS, isBaseTemplate, parametrizeAgentsMd, renderAdapters } from './lib/adapters.mjs';
import { FALLBACK_STACKS, runPlaybookSync } from './sync-playbook.mjs';

const __filename = fileURLToPath(import.meta.url);

/** Human label of a project language code, e.g. `es` -> `Spanish`. */
const languageLabel = (code) => LANGUAGE_LABELS[code];

const LANGUAGE_CHOICES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
];

/** Presentation only. The offered values come from FALLBACK_STACKS. */
const STACK_LABELS = {
  react: 'react     -  forms (RHF + Zod), Radix/Tailwind, Recharts',
  mobile: 'mobile    -  mobile-first UX, sheets, safe areas, Capacitor',
  pwa: 'pwa       -  manifest, icons, service worker consistency',
};

/** Dependency names that signal a stack pack in package.json. */
const STACK_SIGNALS = {
  react: ['react', 'react-dom', 'next'],
  mobile: ['@capacitor/core', 'capacitor', 'react-native', 'expo'],
  pwa: ['vite-plugin-pwa', 'workbox-window', 'workbox-webpack-plugin', 'next-pwa'],
};

/** Dependency to label map per AGENTS.md category. First match order is priority order. */
const TECH_STACK_RULES = [
  {
    category: 'Frontend',
    signals: [['next', 'Next.js'], ['react', 'React'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['@angular/core', 'Angular']],
  },
  {
    category: 'Backend / DB',
    signals: [
      ['@nestjs/core', 'NestJS'], ['fastify', 'Fastify'], ['express', 'Express'], ['koa', 'Koa'],
      ['postgres', 'PostgreSQL'], ['pg', 'PostgreSQL'], ['prisma', 'Prisma'], ['mongoose', 'MongoDB'], ['better-sqlite3', 'SQLite'],
    ],
  },
  {
    category: 'Styling',
    signals: [['tailwindcss', 'Tailwind CSS'], ['styled-components', 'styled-components'], ['sass', 'Sass'], ['less', 'Less']],
  },
  {
    category: 'Forms & Validation',
    signals: [['react-hook-form', 'React Hook Form'], ['zod', 'Zod'], ['yup', 'Yup'], ['ajv', 'AJV']],
  },
  {
    category: 'Testing',
    signals: [['vitest', 'Vitest'], ['jest', 'Jest'], ['@playwright/test', 'Playwright'], ['mocha', 'Mocha']],
  },
];

const NOT_DETECTED = 'Not detected in package.json';

/**
 * Fixed part of `.gripm/config.json`, mirroring the shape the Gripm Board writes
 * and reads itself (bin/gripm.js). projectName, projectId, codePrefix and
 * language are filled per project.
 */
const BOARD_DEFAULTS = {
  theme: 'dark',
  density: 'comfortable',
  autoSave: true,
  mode: 'single',
  methodology: 'kanban',
  enabledTabs: { kanban: true, sprint: false, release: true },
  kanban: {
    showIdeasByDefault: false,
    showDoneHistoryByDefault: false,
    wipLimits: { 'col-doing': 0, 'col-review': 0, 'col-ready': 0 },
  },
  version: '1.0.0',
};

function readPackageJson(repo) {
  const file = path.join(repo, 'package.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function dependenciesOf(pkg) {
  return { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
}

function detectStacks(deps) {
  return Object.entries(STACK_SIGNALS)
    .filter(([, signals]) => signals.some((signal) => deps[signal]))
    .map(([pack]) => pack);
}

function detectTechStack(deps) {
  const detected = {};
  for (const rule of TECH_STACK_RULES) {
    const hits = [...new Set(rule.signals.flatMap(([dep, label]) => (deps[dep] ? [label] : [])))];
    detected[rule.category] = hits.length ? hits.join(' + ') : NOT_DETECTED;
  }
  return detected;
}

function stackChoices() {
  return Object.keys(FALLBACK_STACKS).map((value) => ({ value, label: STACK_LABELS[value] || value }));
}

async function collectAnswers(repo, opts) {
  const pkg = readPackageJson(repo);
  const deps = dependenciesOf(pkg);

  const answers = {
    projectName: opts.name || pkg?.name || path.basename(path.resolve(repo)),
    language: (opts.lang || 'en').toLowerCase(),
    harnesses: opts.harnesses.length ? [...opts.harnesses] : ['antigravity'],
    stacks: opts.stacks.length ? [...opts.stacks] : detectStacks(deps),
    board: opts.board === null ? true : opts.board,
    techStack: detectTechStack(deps),
  };

  if (opts.yes || !process.stdin.isTTY) return answers;

  answers.projectName = await promptText('Project name', answers.projectName);
  answers.language = await promptSelect('Language', LANGUAGE_CHOICES, answers.language);
  answers.harnesses = await promptMultiSelect('AI harnesses', HARNESS_CHOICES, answers.harnesses);

  const detected = answers.stacks.length ? ` (auto-detected: ${answers.stacks.join(', ')})` : '';
  answers.stacks = await promptMultiSelect(`Stack packs${detected}`, stackChoices(), answers.stacks);

  answers.board = await promptConfirm('Configure the Gripm Board (.gripm/config.json)', answers.board);

  return answers;
}

function validateAnswers(answers) {
  const unknownHarness = answers.harnesses.filter(
    (value) => !HARNESS_CHOICES.some((option) => option.value === value),
  );
  if (unknownHarness.length) {
    return `Unknown harness "${unknownHarness[0]}". Available: ${HARNESS_CHOICES.map((o) => o.value).join(', ')}`;
  }

  const unknownStack = answers.stacks.filter((value) => !Object.keys(FALLBACK_STACKS).includes(value));
  if (unknownStack.length) {
    return `Unknown stack pack "${unknownStack[0]}". Available: ${Object.keys(FALLBACK_STACKS).join(', ')}`;
  }

  if (!languageLabel(answers.language)) {
    return `Unknown language "${answers.language}". Available: ${Object.keys(LANGUAGE_LABELS).join(', ')}`;
  }

  return null;
}

function parametrizeAgentsMdFile(repo, answers) {
  const file = path.join(repo, 'AGENTS.md');

  if (!fs.existsSync(file)) {
    console.error(`\n  ${c.red('✖')}  AGENTS.md was not created, nothing to parametrize. Check the sync output above.\n`);
    process.exitCode = 1;
    return false;
  }

  const content = fs.readFileSync(file, 'utf8');

  if (!isBaseTemplate(content)) {
    console.log(`  ${c.dim('•')} ${c.dim('preserved'.padEnd(10))} AGENTS.md ${c.dim('(custom file, left untouched)')}`);
    return true;
  }

  try {
    const next = parametrizeAgentsMd(content, {
      projectName: answers.projectName,
      language: answers.language,
      techStack: answers.techStack,
    });
    fs.writeFileSync(file, next, 'utf8');
    console.log(`  ${c.green('✔')} ${c.green('parametrized'.padEnd(10))} AGENTS.md ${c.dim('(project name, language, stack)')}`);
    return true;
  } catch (err) {
    console.error(`\n  ${c.red('✖')}  ${err.message}\n`);
    process.exitCode = 2;
    return false;
  }
}

function writeAdapters(repo, answers, opts) {
  const files = renderAdapters(answers.projectName, answers.harnesses);

  if (!files.length) {
    console.log(`  ${c.dim('•')} ${c.dim('adapters'.padEnd(10))} ${c.dim('antigravity reads AGENTS.md and .agents/, already installed')}`);
    return;
  }

  for (const file of files) {
    const target = path.join(repo, file.relativePath);

    if (fs.existsSync(target) && !opts.force) {
      if (fs.readFileSync(target, 'utf8') === file.content) {
        console.log(`  ${c.dim('•')} ${c.dim('unchanged'.padEnd(10))} ${file.relativePath}`);
      } else {
        console.log(`  ${c.yellow('▲')} ${c.yellow('protected'.padEnd(10))} ${file.relativePath} ${c.dim('(local file kept, --force overwrites)')}`);
      }
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content, 'utf8');
    console.log(`  ${c.green('✔')} ${c.green('created'.padEnd(10))} ${file.relativePath}`);
  }
}

function writeBoardConfig(repo, answers, opts) {
  const dir = path.join(repo, '.gripm');
  const file = path.join(dir, 'config.json');

  if (fs.existsSync(file) && !opts.force) {
    console.log(`  ${c.dim('•')} ${c.dim('preserved'.padEnd(10))} .gripm/config.json ${c.dim('(existing board settings)')}`);
  } else {
    const name = answers.projectName;
    const config = {
      projectName: name,
      projectId: name.toLowerCase().replace(/^@[^/]+\//, '').replace(/[^a-z0-9_-]/g, '-'),
      codePrefix: name.replace(/^@[^/]+\//, '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase() || 'PROJ',
      language: answers.language,
      ...BOARD_DEFAULTS,
    };

    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    console.log(`  ${c.green('✔')} ${c.green('created'.padEnd(10))} .gripm/config.json ${c.dim('(Gripm Board)')}`);
  }
}

/** The item pool is part of the framework, not of the Board: always present. */
function writeItemPool(repo) {
  const tasks = path.join(repo, 'backlog', 'tasks');
  if (!fs.existsSync(tasks)) {
    fs.mkdirSync(tasks, { recursive: true });
    console.log(`  ${c.green('✔')} ${c.green('created'.padEnd(10))} backlog/tasks/ ${c.dim('(item pool)')}`);
  }
}

function addPlaybookScripts(repo) {
  const pkgFile = path.join(repo, 'package.json');
  if (!fs.existsSync(pkgFile)) return;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    pkg.scripts = pkg.scripts || {};
    let added = 0;
    const scriptsToAdd = {
      'gate:qa': 'playbook gate',
      'gate:review': 'playbook review',
      'audit:ux': 'playbook audit',
      'audit:ux:strict': 'playbook audit --strict',
      'check:loc': 'playbook check-loc',
    };
    for (const [key, cmd] of Object.entries(scriptsToAdd)) {
      if (!pkg.scripts[key]) {
        pkg.scripts[key] = cmd;
        added += 1;
      }
    }
    if (added > 0) {
      fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      console.log(`  ${c.green('✔')} ${c.green('updated'.padEnd(10))} package.json ${c.dim(`(${added} playbook script${added > 1 ? 's' : ''} added)`)}`);
    } else {
      console.log(`  ${c.dim('•')} ${c.dim('preserved'.padEnd(10))} package.json ${c.dim('(scripts already present)')}`);
    }
  } catch {
    // Non-fatal if package.json cannot be parsed or modified
  }
}

function printHarnesses() {
  console.log(`\n  ${c.bold('gripm')} ${c.dim('· Playbook Harnesses')}\n`);
  for (const harness of HARNESS_CHOICES) {
    console.log(`  • ${c.bold(harness.value.padEnd(12))} ${harness.label}`);
  }
  console.log(`
  ${c.dim('Install with:')}  node scripts/init.mjs --harness <name>
  ${c.dim('Default:')}       antigravity (AGENTS.md + .agents/)
  ${c.dim('All of them:')}   node scripts/init.mjs --harness cursor --harness claude
`);
}

function printUsage() {
  console.log(
    fs
      .readFileSync(__filename, 'utf8')
      .split('*/')[0]
      .replace(/^\/\*\*?/, '')
      .replace(/^ \* ?/gm, ''),
  );
}

export async function runInit(argv = []) {
  const opts = parseArgs(argv);

  if (opts.help) {
    printUsage();
    return;
  }
  if (opts.listHarnesses) {
    printHarnesses();
    return;
  }

  const repo = path.resolve(opts.repo);
  printHeader('Playbook Init');
  console.log(`  ${c.dim('➜')}  ${c.dim('Target:')}      ${repo}`);

  const answers = await collectAnswers(repo, opts);
  const invalid = validateAnswers(answers);
  if (invalid) {
    console.error(`\n  ${c.red('✖')}  ${invalid}\n`);
    process.exitCode = 2;
    return;
  }

  console.log(`  ${c.dim('➜')}  ${c.dim('Project:')}     ${answers.projectName}`);
  console.log(`  ${c.dim('➜')}  ${c.dim('Language:')}     ${languageLabel(answers.language)}`);
  console.log(`  ${c.dim('➜')}  ${c.dim('Harnesses:')}    ${answers.harnesses.join(', ')}`);
  console.log(`  ${c.dim('➜')}  ${c.dim('Stack packs:')}  ${answers.stacks.length ? answers.stacks.join(', ') : '(core only)'}`);
  console.log(`  ${c.dim('➜')}  ${c.dim('Gripm Board:')}  ${answers.board ? 'yes' : 'no'}\n`);

  await runPlaybookSync(repo, {
    source: opts.source,
    tag: opts.tag,
    remote: opts.remote,
    stacks: answers.stacks,
    initAgents: true,
    yes: opts.yes,
    force: opts.force,
    installScripts: opts.installScripts,
  });

  if (!parametrizeAgentsMdFile(repo, answers)) return;

  writeAdapters(repo, answers, opts);
  writeItemPool(repo);
  addPlaybookScripts(repo);
  if (answers.board) writeBoardConfig(repo, answers, opts);

  console.log(`
  ${c.bold('Next steps')}
    ${c.dim('1.')}  Read ${c.cyan('AGENTS.md')}: it now describes your project, stack and language.
    ${c.dim('2.')}  Add the first item under ${c.cyan('backlog/tasks/')} and let your agent pick it up.
    ${c.dim('3.')}  Re-run this wizard any time: it is idempotent and never overwrites what a human wrote.
`);
}

function parseArgs(argv) {
  const opts = {
    repo: process.cwd(),
    source: null,
    tag: null,
    remote: undefined,
    stacks: [],
    harnesses: [],
    name: null,
    lang: null,
    board: null,
    force: false,
    yes: false,
    listHarnesses: false,
    help: false,
    installScripts: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case 'init': break;
      case '--repo': case '-r': opts.repo = path.resolve(next()); break;
      case '--source': case '--from': opts.source = path.resolve(next()); break;
      case '--tag': case '-t': opts.tag = next(); break;
      case '--remote': opts.remote = next(); break;
      case '--stack': case '-s': opts.stacks.push(next()); break;
      case '--harness': opts.harnesses.push(next()); break;
      case '--name': opts.name = next(); break;
      case '--lang': case '-l': opts.lang = next(); break;
      case '--board': opts.board = true; break;
      case '--no-board': opts.board = false; break;
      case '--install-scripts': opts.installScripts = true; break;
      case '--force': case '-f': opts.force = true; break;
      case '--yes': case '-y': opts.yes = true; break;
      case '--list-harnesses': opts.listHarnesses = true; break;
      case '--help': case '-h': opts.help = true; break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(2);
    }
  }

  return opts;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runInit(process.argv.slice(2)).catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(2);
  });
}
