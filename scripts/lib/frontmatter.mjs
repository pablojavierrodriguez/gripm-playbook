/**
 * scripts/lib/frontmatter.mjs
 *
 * Minimal flat YAML frontmatter reader, AC extractor, and frontmatter mutator.
 */

export function collectList(body, key) {
  const lines = body.split('\n');
  const pattern = new RegExp(`^${key}\\s*:`, 'i');
  const matches = [];
  lines.forEach((line, index) => {
    if (pattern.test(line)) matches.push(index);
  });
  if (matches.length !== 1) return [];

  const start = matches[0];
  const colonAt = lines[start].indexOf(':');
  const inline = lines[start].slice(colonAt + 1).trim();
  if (inline.startsWith('[')) {
    return inline
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }
  if (inline) return [inline];

  const items = [];
  for (let i = start + 1; i < lines.length; i++) {
    const item = lines[i].match(/^\s*-\s*(.+)$/);
    if (!item) break;
    items.push(item[1].trim().replace(/^['"]|['"]$/g, ''));
  }
  return items;
}

export function readFrontmatter(content) {
  if (typeof content !== 'string') return null;
  const text = content.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  if (end === -1) return null;

  const body = text.slice(4, end);
  const data = {};
  const seen = new Set();

  for (const line of body.split('\n')) {
    const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (seen.has(key)) data.__duplicateKeys = [...(data.__duplicateKeys || []), key];
    else seen.add(key);
    data[key] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }

  data.dependencies = collectList(body, 'dependencies');
  if (/^[\t ]+dependencies\s*:/im.test(body)) data.__nestedDependencies = true;

  return data;
}

export function readACs(content) {
  if (typeof content !== 'string') return null;
  const text = content.replace(/\r\n/g, '\n');
  const start = text.indexOf('<!-- AC:BEGIN -->');
  const end = text.indexOf('<!-- AC:END -->');
  if (start === -1 || end === -1 || end < start) return null;

  return text
    .slice(start + '<!-- AC:BEGIN -->'.length, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ['));
}

export function mutateTaskFrontmatter(content, { status, set = {}, remove = [] } = {}) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return content;
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) return content;

  const removeSet = new Set(remove.map((k) => k.toLowerCase()));
  const setEntries = new Map(Object.entries(set).map(([k, v]) => [k.toLowerCase(), { key: k, val: v }]));
  const today = new Date().toISOString().slice(0, 10);

  const lines = normalized.slice(4, end).split('\n');
  const nextLines = [];
  let statusUpdated = false;

  for (const line of lines) {
    const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) {
      nextLines.push(line);
      continue;
    }
    const keyLower = match[1].toLowerCase();
    if (removeSet.has(keyLower)) continue;
    if (keyLower === 'status' && status) {
      nextLines.push(`status: ${status}`);
      statusUpdated = true;
      continue;
    }
    if (keyLower === 'updated_date') {
      nextLines.push(`updated_date: '${today}'`);
      continue;
    }
    if (setEntries.has(keyLower)) {
      const { key, val } = setEntries.get(keyLower);
      nextLines.push(`${key}: "${val}"`);
      setEntries.delete(keyLower);
      continue;
    }
    nextLines.push(line);
  }

  if (status && !statusUpdated) {
    nextLines.push(`status: ${status}`);
  }
  for (const { key, val } of setEntries.values()) {
    nextLines.push(`${key}: "${val}"`);
  }

  const rebuilt = `---\n${nextLines.join('\n')}${normalized.slice(end)}`;
  return eol === '\r\n' ? rebuilt.replace(/\n/g, '\r\n') : rebuilt;
}
