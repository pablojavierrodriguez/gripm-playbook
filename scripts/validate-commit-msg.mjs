#!/usr/bin/env node

/**
 * scripts/validate-commit-msg.mjs
 *
 * Mechanical validator for Git commit messages (PLAY-047 / DEV-339 / DEV-345).
 * Enforces Conventional Commits syntax, mandatory English language rules, and Anti-Em-Dash policy.
 *
 * Usage:
 *   node scripts/validate-commit-msg.mjs <commit_msg_file>
 *   node scripts/validate-commit-msg.mjs --message "feat(gate): add validation"
 *
 * Exit codes: 0 valid · 1 rejected · 2 fatal usage error
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { c } from './lib/terminal.mjs';

const __filename = fileURLToPath(import.meta.url);

export const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([a-zA-Z0-9_.\-\/#]+\))?!?: (.+)$/;

export const IGNORED_PREFIXES = [
  /^Merge (?:branch|pull request|remote-tracking branch|tag)\b/i,
  /^(?:v?\d+\.\d+\.\d+|Release v?\d+\.\d+\.\d+)/,
  /^Revert "[^"]+"/,
  /^(?:fixup|squash)! /,
];

export const SPANISH_PATTERNS = [
  /\b(agrega|agregado|agregar|agrego|agregó|anade|anadido|anadir|añade|añadido|añadir|añado|añadió|crea|crear|creado|creo|creó|corrige|corregido|corregir|corrijo|corrigió|arregla|arreglar|arreglado|arreglo|arregló)\b/i,
  /\b(elimina|eliminar|eliminado|elimino|eliminó|borra|borrar|borrado|borro|borró|actualiza|actualizar|actualizado|actualizo|actualizó|cambia|cambiar|cambiado|cambio|cambió)\b/i,
  /\b(modifica|modificar|modificado|modifico|modificó|resuelve|resolver|resuelto|resuelvo|resolvió|implementa|implementar|implementado|implemento|implementó|unifica|unificar|unificado)\b/i,
  /\b(mejora|mejorar|mejorado|refactoriza|refactorizar|refactorizado|configura|configurar|configurado|limpia|limpiar|limpiado|ajuste|ajustes|ajusta|ajustar|ajustado)\b/i,
  /\b(sincroniza|sincronizar|sincronizado|renombra|renombrar|renombrado|desacopla|desacoplar|desacoplado)\b/i,
  /\b(soporte|saneamiento|validacion|validaciones|documentacion|pruebas|reemplaza|reemplazar|reemplazado|guardar)\b/i,
  /\b(para|con|del|los|las|una|unos|unas|por|hacia|desde|sobre|nuevo|nueva|nuevos|nuevas|tambien|también|tarea|tareas|segun|según)\b/i,
  /[áéíóúÁÉÍÓÚñÑ¿¡]/,
];

export const EM_DASH_REGEX = /[\u2013\u2014]/;

export function validateCommitMessage(rawMessage) {
  const errors = [];
  const warnings = [];

  if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
    errors.push('Commit message cannot be empty.');
    return { valid: false, errors, warnings, reason: 'Commit message cannot be empty.' };
  }

  // Extract first non-comment line as header
  const lines = rawMessage
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (!lines.length) {
    errors.push('Commit message contains only comments or whitespace.');
    return { valid: false, errors, warnings, reason: 'Commit message contains only comments or whitespace.' };
  }

  const header = lines[0];

  // Pass through automated git operations
  for (const pattern of IGNORED_PREFIXES) {
    if (pattern.test(header)) {
      return { valid: true, errors: [], warnings: [], reason: undefined, header };
    }
  }

  // Anti-Em-Dash / Anti-AI check
  if (EM_DASH_REGEX.test(header)) {
    errors.push(
      'Anti-Em-Dash violation: em-dash (—) and en-dash (–) are prohibited in commit messages. Use standard hyphen (-) with spaces.',
    );
  }

  const match = header.match(CONVENTIONAL_COMMIT_REGEX);
  if (!match) {
    errors.push(
      `Header "${header}" does not follow Conventional Commits format: <type>(<scope>): <subject> or <type>: <subject>.\n` +
        `    Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.`,
    );
  } else {
    const [, type, subject] = match;
    const trimmedSubject = subject.trim();

    if (!trimmedSubject) {
      errors.push('Commit subject cannot be empty.');
    }
  }

  // Detect Spanish vocabulary or characters in header
  for (const pattern of SPANISH_PATTERNS) {
    const spMatch = header.match(pattern);
    if (spMatch) {
      errors.push(
        `Commit header must be 100% in imperative English. Detected Spanish term/pattern: "${spMatch[0]}".\n` +
          `    Methodological obligation: Translate titles and descriptions from Spanish tickets to English before committing.`,
      );
      break;
    }
  }

  const reason = errors.length > 0 ? errors.join('; ') : undefined;

  return {
    valid: errors.length === 0,
    errors,
    reason,
    warnings,
    header,
    type: match ? match[1] : undefined,
    subject: match ? match[2].trim() : undefined,
  };
}

export function runCli(argv = process.argv.slice(2)) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`
  ${c.bold('gripm · Commit Message Validator (PLAY-047 / DEV-339)')}

  Enforces Conventional Commits syntax, 100% English requirement, and Anti-Em-Dash policy.

  ${c.bold('Usage:')}
    node scripts/validate-commit-msg.mjs <commit_msg_file>
    node scripts/validate-commit-msg.mjs --message "<message>"

  ${c.bold('Examples:')}
    node scripts/validate-commit-msg.mjs .git/COMMIT_EDITMSG
    node scripts/validate-commit-msg.mjs --message "feat(gate): add anti-slop check"
`);
    process.exit(0);
  }

  let raw = '';
  const msgIdx = argv.indexOf('--message');
  if (msgIdx !== -1 && argv[msgIdx + 1]) {
    raw = argv[msgIdx + 1];
  } else if (argv.length > 0 && !argv[0].startsWith('--')) {
    const filePath = path.resolve(argv[0]);
    if (!fs.existsSync(filePath)) {
      console.error(`\n  ${c.red('✖')} File not found: ${filePath}\n`);
      process.exit(2);
    }
    raw = fs.readFileSync(filePath, 'utf8');
  } else {
    console.error(`\n  ${c.red('✖')} Missing commit message or file path. Run with --help for usage.\n`);
    process.exit(2);
  }

  const result = validateCommitMessage(raw);

  if (!result.valid) {
    console.error(`\n  ${c.red('✖ INVALID COMMIT MESSAGE (Commit message rejected):')}`);
    for (const err of result.errors) {
      console.error(`    ${c.red('•')} ${err}`);
    }
    console.error('');
    process.exit(1);
  }

  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runCli();
}
