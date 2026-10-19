/**
 * scripts/lib/doc-checks.mjs
 *
 * Documentation integrity checks: markdown links, skill frontmatter, and status vocabulary.
 */

import fs from 'node:fs';
import path from 'node:path';

export function checkMarkdownLinks(root, onFail) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) files.push(path.relative(root, full));
    }
  };
  walk(root);

  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const clean = target.split('#')[0];
      if (!clean) continue;
      const resolved = path.resolve(path.dirname(path.join(root, file)), clean);
      if (!fs.existsSync(resolved)) onFail('links', `${file} links to a missing path: ${target}`);
    }
  }
}

export function checkSkillFrontmatter(root, onFail, onWarn) {
  const dirs = [
    '.agents/skills',
    '.agents/stacks/react/skills',
    '.agents/stacks/mobile/skills',
    '.agents/stacks/pwa/skills',
  ];

  for (const dir of dirs) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rel = `${dir}/${entry.name}/SKILL.md`;
      const full = path.join(root, rel);
      if (!fs.existsSync(full)) {
        onFail('frontmatter', `${dir}/${entry.name}/ has no SKILL.md`);
        continue;
      }
      const content = fs.readFileSync(full, 'utf8');
      if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
        onFail('frontmatter', `${rel} has no YAML frontmatter`);
        continue;
      }
      const normalized = content.replace(/\r\n/g, '\n');
      const end = normalized.indexOf('\n---', 4);
      if (end === -1) {
        onFail('frontmatter', `${rel} frontmatter is not closed`);
        continue;
      }
      const fm = normalized.slice(4, end);
      const name = fm.match(/^name:\s*(.+)$/m);
      const description = fm.match(/^description:\s*(.+)$/m);
      if (!name) onFail('frontmatter', `${rel} has no "name"`);
      else if (name[1].trim() !== entry.name) {
        onFail('frontmatter', `${rel} declares name "${name[1].trim()}" but lives in folder "${entry.name}"`);
      }
      if (!description) onFail('frontmatter', `${rel} has no "description"`);
      else if (description[1].trim().length < 40 && onWarn) {
        onWarn('frontmatter', `${rel} has a very short description; skill triggering depends on it`);
      }
    }
  }
}

export function validateStatusVocabulary(root, canonicalStatuses, onFail = null) {
  const errs = [];
  const report = (msg) => {
    errs.push(msg);
    if (onFail) onFail('status', msg);
  };
  const exists = (rel) => fs.existsSync(path.join(root, rel));
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  const banned = [
    { token: 'In Engineering', file: 'docs/sprints/SPRINT_SPEC_TEMPLATE.md' },
    { token: 'Passed QA', file: 'docs/sprints/SPRINT_SPEC_TEMPLATE.md' },
  ];
  for (const { token, file } of banned) {
    if (exists(file) && read(file).includes(token)) {
      report(`${file} still uses the legacy status name "${token}"`);
    }
  }

  if (!exists('.agents/STATE_MACHINE.md')) {
    report('.agents/STATE_MACHINE.md is missing');
    return errs;
  }
  const stateMachineText = read('.agents/STATE_MACHINE.md');

  const tableRows = [...stateMachineText.matchAll(/^\|\s*\*\*[^|]+\*\*\s*\|\s*`([a-z]+)`\s*\|/gm)].map((m) => m[1]);
  if (!tableRows.length) {
    report('STATE_MACHINE.md no longer has a parseable status table');
    return errs;
  }

  for (const status of canonicalStatuses) {
    if (!tableRows.includes(status)) {
      report(
        `.agents/STATE_MACHINE.md does not define "${status}" as a row in the status table. A token appearing elsewhere in the file is not a definition.`,
      );
    }
  }

  for (const row of tableRows) {
    if (!canonicalStatuses.includes(row)) {
      report(`STATE_MACHINE.md defines "${row}" as a status, but it is not in the canonical vocabulary`);
    }
  }

  if (/\|\s*`backlog`\s*\|/.test(stateMachineText)) {
    report('STATE_MACHINE.md lists "backlog" as a status. The backlog is the absence of status; refinement is a gate.');
  }

  const backlogDoc = 'docs/BACKLOG.md';
  if (exists(backlogDoc)) {
    const declared = read(backlogDoc)
      .split('\n')
      .filter((line) => /\*\*Status válidos:\*\*/.test(line) || /^\s*-\s+\*\*Status:\*\*/.test(line))
      .flatMap((line) => [...line.matchAll(/`([a-z]+)`/g)].map((m) => m[1]));

    for (const status of new Set(declared)) {
      if (!canonicalStatuses.includes(status)) {
        report(
          `${backlogDoc} publishes "${status}" as a valid status, but STATE_MACHINE.md does not define it. A project copying this document would use a status nothing handles.`,
        );
      }
    }
  }

  for (const doc of ['AGENTS.md', '.agents/TEAM_PLAYBOOK.md']) {
    if (!exists(doc)) continue;
    if (!read(doc).includes('STATE_MACHINE.md')) {
      report(`${doc} does not reference .agents/STATE_MACHINE.md - the state table must have a single source of truth`);
    }
  }

  return errs;
}
