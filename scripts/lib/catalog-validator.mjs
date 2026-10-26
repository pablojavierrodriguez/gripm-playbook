/**
 * scripts/lib/catalog-validator.mjs
 *
 * Validates local `.uxaudit.json` rule catalogs against canonical rules.
 */

import fs from 'node:fs';
import path from 'node:path';

export function validateLocalCatalog(root, canonicalRoot = root, onFail = null) {
  const localErrors = [];
  const report = (msg) => {
    localErrors.push(msg);
    if (onFail) onFail('local-catalog', msg);
  };

  const gripmConfigDot = path.join(root, '.gripm', '.uxaudit.json');
  const gripmConfigNoDot = path.join(root, '.gripm', 'uxaudit.json');
  const rootConfig = path.join(root, '.uxaudit.json');
  const configPath = fs.existsSync(gripmConfigDot)
    ? gripmConfigDot
    : fs.existsSync(gripmConfigNoDot)
      ? gripmConfigNoDot
      : rootConfig;
  if (!fs.existsSync(configPath)) return localErrors;

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    report(`.uxaudit.json is not valid JSON: ${err.message}`);
    return localErrors;
  }

  if (!config || !config.rules) return localErrors;

  const localCatalogPath = path.resolve(root, config.rules);
  if (!fs.existsSync(localCatalogPath)) {
    report(`Configured local rules file does not exist: ${config.rules}`);
    return localErrors;
  }

  let catalog;
  try {
    catalog = JSON.parse(fs.readFileSync(localCatalogPath, 'utf8'));
  } catch (err) {
    report(`Local rules catalog ${config.rules} is not valid JSON: ${err.message}`);
    return localErrors;
  }

  if (!Array.isArray(catalog.rules)) {
    report(`Local rules catalog ${config.rules} does not declare a "rules" array`);
    return localErrors;
  }

  let canonicalCatalog = { rules: [] };
  const canonicalPath = fs.existsSync(path.join(root, 'scripts/ux-rules.json'))
    ? path.join(root, 'scripts/ux-rules.json')
    : path.join(canonicalRoot, 'scripts/ux-rules.json');
  if (fs.existsSync(canonicalPath)) {
    try {
      canonicalCatalog = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
    } catch {}
  }
  const canonicalMap = new Map((canonicalCatalog.rules || []).map((r) => [r.id, r]));

  const seenIds = new Set();
  for (const rule of catalog.rules) {
    for (const field of ['id', 'title', 'severity', 'message']) {
      if (!rule[field]) {
        report(`Local rule is missing required field "${field}": ${JSON.stringify(rule)}`);
      }
    }

    if (rule.severity && !['ERROR', 'WARNING', 'INFO'].includes(rule.severity)) {
      report(`Local rule "${rule.id || '(unnamed)'}" has invalid severity "${rule.severity}". Allowed: ERROR, WARNING, INFO.`);
    }

    const hasValidCheck =
      rule.check &&
      typeof rule.check === 'object' &&
      ((Array.isArray(rule.check.line) && rule.check.line.length > 0) ||
        (Array.isArray(rule.check.alsoContent) && rule.check.alsoContent.length > 0) ||
        (Array.isArray(rule.check.file) && rule.check.file.length > 0) ||
        Boolean(rule.check.type));

    if (!hasValidCheck) {
      report(`Local rule "${rule.id || '(unnamed)'}" is missing a valid "check" definition`);
    }

    if (rule.id) {
      if (seenIds.has(rule.id)) {
        report(`Duplicate rule id in local catalog: ${rule.id}`);
      }
      seenIds.add(rule.id);

      if (canonicalMap.has(rule.id)) {
        const canonicalRule = canonicalMap.get(rule.id);
        report(
          `Local rule "${rule.id}" collides with canonical rule "${canonicalRule.title}". Local rule IDs must be unique.`,
        );
      } else if (typeof rule.id === 'string' && /^UX-\d{3}$/.test(rule.id)) {
        report(
          `Local rule "${rule.id}" uses the reserved canonical pattern "UX-NNN". Local rules must use a project-specific prefix.`,
        );
      }
    }
  }

  return localErrors;
}
