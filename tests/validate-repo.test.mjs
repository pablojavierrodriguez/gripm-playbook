import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = path.join(ROOT, 'scripts', 'validate-repo.mjs');
const MANIFEST = path.join(ROOT, '.playbook-manifest.json');
const SYNC = path.join(ROOT, 'scripts', 'sync-playbook.mjs');

const repoSource = (file) => fs.readFileSync(file, 'utf8');
const repoManifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

// The canonical vocabulary lives in the validator; reading it from the source
// keeps this test from drifting into a second copy of the list.
const CANONICAL_STATUSES = [
  ...repoSource(path.join(ROOT, 'scripts', 'validate-repo.mjs'))
    .match(/const CANONICAL_STATUSES = \[([^\]]+)\]/)[1]
    .matchAll(/'([^']+)'/g),
].map((m) => m[1]);

/**
 * Builds a throwaway copy of the repo with one file mutated, so the validator can
 * be run against a broken state. Copying is required because the validator
 * resolves every path relative to its own location.
 */
function sandbox(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-'));
  for (const rel of ['scripts', 'docs', '.agents', 'backlog', 'tests']) {
    const from = path.join(ROOT, rel);
    if (fs.existsSync(from)) {
      fs.cpSync(from, path.join(dir, rel), { recursive: true });
    }
  }
  for (const rel of ['package.json', '.playbook-manifest.json', 'AGENTS.md', 'CONTRIBUTING.md', 'CHANGELOG.md']) {
    const from = path.join(ROOT, rel);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dir, rel));
  }
  mutate(dir);
  return dir;
}

function runValidator(dir) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(dir, 'scripts', 'validate-repo.mjs')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout };
  } catch (err) {
    if (err.status === undefined) throw err;
    return { code: err.status, stdout: `${err.stdout || ''}${err.stderr || ''}` };
  }
}

describe('manifest ⇄ documentation (PLAY-020 AC #2)', () => {
  test('the real repo passes', () => {
    const { code } = runValidator(ROOT);
    assert.equal(code, 0, 'the shipped repo must satisfy its own check');
  });

  test('the gate is installed by the manifest', () => {
    assert.ok(repoManifest().core.includes('scripts/gate-qa.mjs'));
  });

  test('the domain template is installed by the manifest', () => {
    assert.ok(repoManifest().core.includes('docs/DOMAIN_TEMPLATE.md'));
  });

  test('fails when a core skill documents a script the manifest does not install', () => {
    const dir = sandbox((root) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, '.playbook-manifest.json'), 'utf8'));
      manifest.core = manifest.core.filter((f) => f !== 'scripts/gate-qa.mjs');
      fs.writeFileSync(path.join(root, '.playbook-manifest.json'), JSON.stringify(manifest, null, 2));
    });

    const { code, stdout } = runValidator(dir);
    assert.notEqual(code, 0, 'a documented-but-uninstalled command must fail the build');
    assert.match(stdout, /manifest does not install it/);
  });

  test('reports each (document, target) pair once', () => {
    const dir = sandbox((root) => {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, '.playbook-manifest.json'), 'utf8'));
      manifest.core = manifest.core.filter((f) => f !== 'scripts/gate-qa.mjs');
      fs.writeFileSync(path.join(root, '.playbook-manifest.json'), JSON.stringify(manifest, null, 2));
      // Name the same command three times in ONE document. Three documents
      // mentioning it is three defects; three mentions in one document is one.
      const skill = path.join(root, '.agents', 'skills', 'qa-auditor', 'SKILL.md');
      fs.writeFileSync(skill, `${fs.readFileSync(skill, 'utf8')}\n\nnode scripts/gate-qa.mjs again\nnode scripts/gate-qa.mjs once more\n`);
    });

    const { stdout } = runValidator(dir);
    const forThisDoc = stdout
      .split('\n')
      .filter((l) => l.includes('qa-auditor') && l.includes('does not install'));
    assert.equal(forThisDoc.length, 1, 'a command named three times in one document is one defect');
  });
});

describe('manifest ⇄ FALLBACK_CORE_FILES (PLAY-020 AC #1)', () => {
  test('fails when a manifest entry is missing from the fallback', () => {
    const dir = sandbox((root) => {
      const sync = path.join(root, 'scripts', 'sync-playbook.mjs');
      fs.writeFileSync(sync, repoSource(SYNC).replace("  'scripts/gate-qa.mjs',\n", ''));
    });

    const { code, stdout } = runValidator(dir);
    assert.notEqual(code, 0);
    assert.match(stdout, /missing from FALLBACK_CORE_FILES/);
  });

  test('fails when the fallback carries an entry the manifest does not', () => {
    const dir = sandbox((root) => {
      const sync = path.join(root, 'scripts', 'sync-playbook.mjs');
      fs.writeFileSync(sync, repoSource(SYNC).replace('];', "  'scripts/ghost.mjs',\n];"));
      fs.writeFileSync(path.join(root, 'scripts', 'ghost.mjs'), '// placeholder\n');
    });

    const { code, stdout } = runValidator(dir);
    assert.notEqual(code, 0);
    assert.match(stdout, /in FALLBACK_CORE_FILES but not in the manifest/);
  });

  test('the two lists are in parity in the shipped repo', () => {
    const block = repoSource(SYNC).match(/FALLBACK_CORE_FILES\s*=\s*\[([\s\S]*?)\]/);
    assert.ok(block, 'FALLBACK_CORE_FILES must remain discoverable by the check');
    const fallback = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual([...fallback].sort(), [...repoManifest().core].sort());
  });
});

describe('pyramid parity (PLAY-015 AC #1)', () => {
  test('the real repo passes', () => {
    assert.equal(runValidator(ROOT).code, 0);
  });

  test('fails when the gate stops executing a step the skill declares blocking', () => {
    const dir = sandbox((root) => {
      const p = path.join(root, 'scripts', 'gate-qa.mjs');
      fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^\s*\{ id: 'spec'.*\r?\n/m, ''), 'utf8');
    });

    const { code, stdout } = runValidator(dir);
    assert.notEqual(code, 0, 'a documented blocking step the gate cannot run is a silent hole');
    assert.match(stdout, /declares "Spec - backlog consistency" as blocking/);
  });

  test('control: the shipped repo really does execute every blocking step', () => {
    const gate = repoSource(path.join(ROOT, 'scripts', 'gate-qa.mjs'));
    const table = gate.match(/const PYRAMID_STEPS\s*=\s*\[([\s\S]*?)\n\];/);
    assert.ok(table, 'PYRAMID_STEPS must stay discoverable by the check');
    const ids = [...table[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
    for (const id of ['validate', 'test', 'spec', 'audit:ux', 'build']) {
      assert.ok(ids.includes(id), `the gate must execute ${id}`);
    }
  });
});

describe('status vocabulary is compared, not substring-matched', () => {
  test('fails when a canonical status row is deleted from the state table', () => {
    // The substring version of this check passed with the whole `blocked` row
    // removed, because the token still appeared eight times elsewhere.
    const dir = sandbox((root) => {
      const p = path.join(root, '.agents', 'STATE_MACHINE.md');
      const content = fs.readFileSync(p, 'utf8').replace(/^\|\s*\*\*Delivery\*\*\s*\|\s*`blocked`.*\r?\n/m, '');
      fs.writeFileSync(p, content, 'utf8');
    });

    const { code, stdout } = runValidator(dir);
    assert.notEqual(code, 0, 'a deleted status row must fail even if the token survives in prose');
    assert.match(stdout, /does not define "blocked" as a row/);
  });

  test('fails when BACKLOG.md publishes a status the state machine does not define', () => {
    const dir = sandbox((root) => {
      const p = path.join(root, 'docs', 'BACKLOG.md');
      fs.writeFileSync(
        p,
        fs.readFileSync(p, 'utf8').replace('`ideas` | `draft`', '`ideas` | `archived` | `draft`'),
        'utf8',
      );
    });

    const { code, stdout } = runValidator(dir);
    assert.notEqual(code, 0);
    assert.match(stdout, /publishes "archived" as a valid status/);
  });

  test('the canonical vocabulary covers every documented status', () => {
    assert.deepEqual(
      [...CANONICAL_STATUSES],
      ['ideas', 'draft', 'blocked', 'doing', 'review', 'ready', 'done', 'dismissed'],
    );
  });
});

describe('gate-review-items (CI entry point)', () => {
  const REVIEWER = path.join(ROOT, 'scripts', 'gate-review-items.mjs');

  test('exits 0 when every item in review satisfies the gate', () => {
    const dir = sandbox((root) => {
      const tasks = path.join(root, 'backlog', 'tasks');
      const name = fs.readdirSync(tasks).find((f) => f.startsWith('PLAY-014'));
      if (name) {
        const file = path.join(tasks, name);
        fs.writeFileSync(
          file,
          fs.readFileSync(file, 'utf8').replace(/^status:\s*.+$/m, 'status: review'),
        );
      }
    });
    const stdout = execFileSync(process.execPath, [path.join(dir, 'scripts', 'gate-review-items.mjs')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.match(stdout, /satisfy the task-level gate/);
  });

  test('treats exit 2 from --no-run as success, not failure', () => {
    // This is the bug the first CI version had: it ran `--no-run`, whose exit
    // code is 2 by design, and read that as a failure.
    const stdout = execFileSync(process.execPath, [REVIEWER], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.doesNotMatch(stdout, /FAIL/, 'every reviewed item is currently gate-clean');
  });

  test('fails when an item in review has an unchecked criterion', () => {
    const dir = sandbox((root) => {
      const tasks = path.join(root, 'backlog', 'tasks');
      const name = fs.readdirSync(tasks).find((f) => f.startsWith('PLAY-015'));
      const file = path.join(tasks, name);
      fs.writeFileSync(
        file,
        fs.readFileSync(file, 'utf8')
          .replace(/^status:\s*.+$/m, 'status: review')
          .replace('- [x] #1 ', '- [ ] #1 '),
      );
    });

    let failed = false;
    let output = '';
    try {
      execFileSync(process.execPath, [path.join(dir, 'scripts', 'gate-review-items.mjs')], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      failed = err.status !== 0;
      output = `${err.stdout || ''}${err.stderr || ''}`;
    }
    assert.ok(failed, 'an unchecked acceptance criterion must break the CI gate');
    assert.match(output, /acceptance criteria are still unchecked/, 'CI output must include the specific failure reason from gate-qa.mjs');
  });
});