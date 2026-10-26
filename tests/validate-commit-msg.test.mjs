import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCommitMessage } from '../scripts/validate-commit-msg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'validate-commit-msg.mjs');

function runValidator(args = []) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

describe('validateCommitMessage programmatic API', () => {
  test('accepts valid Conventional Commits in English', () => {
    const validMessages = [
      'feat: add token refresh rotation',
      'fix(gate): allow ready dependencies in T0 and T2',
      'refactor(core): streamline import resolution under 500 lines',
      'docs: update README with release assembly steps',
      'test(commit-msg): add comprehensive unit test suite',
      'chore: bump dependencies',
      'perf(parser): speed up AST lookup',
      'feat(auth)!: replace legacy cookie auth with bearer tokens',
    ];

    for (const msg of validMessages) {
      const res = validateCommitMessage(msg);
      assert.equal(res.valid, true, `expected "${msg}" to be valid`);
      assert.equal(res.errors.length, 0);
    }
  });

  test('accepts multi-line commits with English bulleted body', () => {
    const msg = [
      'feat(gate): implement anti-slop check in qa runner',
      '',
      '- inspects git diff for as unknown as type evasions',
      '- hooks check into inspectTask before promote to ready',
    ].join('\n');

    const res = validateCommitMessage(msg);
    assert.equal(res.valid, true);
    assert.equal(res.type, 'feat');
    assert.equal(res.subject, 'implement anti-slop check in qa runner');
  });

  test('ignores comments in commit message file', () => {
    const msg = [
      '# Please enter the commit message for your changes.',
      '# Lines starting with "#" will be ignored.',
      '',
      'fix(ux): replace arbitrary text size with text-xs',
      '',
      '# More comments here',
    ].join('\n');

    const res = validateCommitMessage(msg);
    assert.equal(res.valid, true);
    assert.equal(res.type, 'fix');
  });

  test('passes automated git operations and version bumps', () => {
    const bypassed = [
      'Merge branch dev into main',
      'Merge pull request #42 from repo/feat-branch',
      'Merge remote-tracking branch origin/main',
      'v2.7.0',
      'Release v2.7.0',
      '2.7.0',
      'Revert "feat(auth): add token refresh rotation"',
    ];

    for (const msg of bypassed) {
      const res = validateCommitMessage(msg);
      assert.equal(res.valid, true, `expected bypass for "${msg}"`);
    }
  });

  test('rejects empty or whitespace-only messages', () => {
    assert.equal(validateCommitMessage('').valid, false);
    assert.equal(validateCommitMessage('   \n  \t  ').valid, false);
    assert.equal(validateCommitMessage('# only comments\n# more comments').valid, false);
  });

  test('rejects messages that do not follow Conventional Commits syntax', () => {
    const invalid = [
      'update files',
      'fix bugs and refactor code',
      'wip',
      'FEAT: add thing',
      'feature: add thing',
      'fix add missing semicolon',
      'unknown(scope): valid structure but invalid type',
    ];

    for (const msg of invalid) {
      const res = validateCommitMessage(msg);
      assert.equal(res.valid, false, `expected "${msg}" to fail conventional syntax`);
      assert.match(res.errors[0], /does not follow Conventional Commits format/);
    }
  });

  test('rejects Spanish verbs in commit header', () => {
    const spanishHeaders = [
      'feat: agrega nuevo validador de commits',
      'fix(gate): corrige bug en resolucion de dependencias',
      'chore: actualiza dependencias de paquete',
      'refactor: unifica logica de inspeccion de tareas',
      'fix: arregla problema con acentos',
      'docs: anade documentacion sobre git workflow',
      'feat: añade soporte para hooks',
      'style: limpia espacios en blanco',
      'test: pruebas unitarias para el gate',
    ];

    for (const msg of spanishHeaders) {
      const res = validateCommitMessage(msg);
      assert.equal(res.valid, false, `expected Spanish message "${msg}" to be rejected`);
      assert.match(res.errors[0], /Commit header must be 100% in imperative English/);
    }
  });

  test('rejects Spanish grammatical words and accented characters in header', () => {
    const spanishSentences = [
      'feat(auth): rotacion de tokens para usuarios',
      'fix(api): solucion con parametros del sistema',
      'chore: limpieza hacia los archivos temporales',
      'feat: autenticación segura con JWT',
    ];

    for (const msg of spanishSentences) {
      const res = validateCommitMessage(msg);
      assert.equal(res.valid, false, `expected "${msg}" to be rejected`);
      assert.match(res.errors[0], /Commit header must be 100% in imperative English/);
    }
  });
});

describe('validate-commit-msg CLI', () => {
  test('exits 0 with valid --message argument', () => {
    const { code } = runValidator(['--message', 'feat(gate): add commit message guardrail']);
    assert.equal(code, 0);
  });

  test('exits 1 with invalid or Spanish --message argument', () => {
    const { code, stderr } = runValidator(['--message', 'feat(gate): agrega validacion']);
    assert.equal(code, 1);
    assert.match(stderr, /INVALID COMMIT MESSAGE/);
    assert.match(stderr, /imperative English/);
  });

  test('reads commit message from file path (git hook standard)', () => {
    const tmp = path.join(os.tmpdir(), `commit-msg-${Date.now()}.txt`);
    try {
      fs.writeFileSync(tmp, 'fix(parser): handle CRLF line endings correctly\n\nDetailed body.\n', 'utf8');
      const { code } = runValidator([tmp]);
      assert.equal(code, 0);

      fs.writeFileSync(tmp, 'fix: corrige error de lectura\n', 'utf8');
      const failRes = runValidator([tmp]);
      assert.equal(failRes.code, 1);
      assert.match(failRes.stderr, /imperative English/);
    } finally {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });

  test('exits 2 when commit message file does not exist', () => {
    const { code, stderr } = runValidator(['non_existent_file.txt']);
    assert.equal(code, 2);
    assert.match(stderr, /File not found/);
  });

  test('exits 0 with --help flag', () => {
    const { code, stdout } = runValidator(['--help']);
    assert.equal(code, 0);
    assert.match(stdout, /Commit Message Validator/);
  });
});
