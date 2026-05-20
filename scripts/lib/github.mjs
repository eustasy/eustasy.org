// Shared helpers for GitHub data fetch scripts.
// Run with `GITHUB_TOKEN=ghp_… bun scripts/fetch-*.mjs` (or in CI with the
// default GITHUB_TOKEN). Without a token, scripts no-op and leave existing
// JSON untouched.

export const TOKEN = process.env.GITHUB_TOKEN;
export const ORGS = ['eustasy', 'eustasy-archive'];
export const USER_AGENT = 'eustasy-site-builder';

export async function gqlQuery(query, variables = {}) {
  if (!TOKEN) throw new Error('GITHUB_TOKEN not set');
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error(`GraphQL HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (j.errors) {
    const benign = j.errors.every(e => e.type === 'NOT_FOUND');
    if (benign) return j.data;
    throw new Error('GraphQL errors: ' + JSON.stringify(j.errors));
  }
  return j.data;
}

export async function restGet(path) {
  if (!TOKEN) throw new Error('GITHUB_TOKEN not set');
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`REST ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

export function daysAgo(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function relTime(iso) {
  if (!iso) return '';
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd';
  if (days < 60) return Math.round(days / 7) + 'w';
  if (days < 365) return Math.round(days / 30) + 'mo';
  return Math.round(days / 365) + 'y';
}

export function relTimeAgo(iso) {
  const t = relTime(iso);
  return t === 'now' ? 'just now' : t + ' ago';
}

export function shortTime(days) {
  if (days < 7) return days + 'd';
  if (days < 60) return Math.round(days / 7) + 'w';
  if (days < 365) return Math.round(days / 30) + 'mo';
  return Math.round(days / 365) + 'y';
}

// Map GitHub primaryLanguage names → design's slug taxonomy.
const LANG_MAP = {
  CSS: 'css',
  JavaScript: 'js',
  TypeScript: 'js',
  PHP: 'php',
  Python: 'python',
  Shell: 'bash',
  HTML: 'html',
  Ruby: 'js',
  Go: 'js',
  Rust: 'js',
};

const DESC_PREFIX_LANG = {
  'CSS-LIB': 'css',
  'BASH': 'bash',
  'PHP-LIB': 'php',
  'PYTHON': 'python',
  'JS-LIB': 'js',
  'JQUERY': 'jq',
  'JQ-LIB': 'jq',
  'STATIC': 'html',
  'STATIC-SITE': 'html',
  'SITE': 'html',
  'CHROME-THEME': 'html',
};

export function classifyLang(repo) {
  const name = repo.name || '';
  const isMeta = name.startsWith('.') && name !== '.ui';
  if (isMeta) return ['meta'];
  if (name === '.ui') return ['ui'];
  // Description TYPE prefix overrides GitHub's auto-detected language.
  const prefixMatch = (repo.description || '').match(/^([A-Z][A-Z-]*)\s*[:.]/);
  if (prefixMatch) {
    const lang = DESC_PREFIX_LANG[prefixMatch[1]];
    if (lang) return [lang];
  }
  const primary = repo.primaryLanguage?.name;
  let lang = LANG_MAP[primary] || 'html';
  if (lang === 'js' && /^jquery/i.test(name)) lang = 'jq';
  return [lang];
}

const STATUS_RE = {
  eol: /^EOL\s*[:.]/i,
  deprecated: /^DEPRECATED\s*[:.]/i,
  alpha: /^ALPHA\s*[:.]/i,
};

export function classifyStatus(repo, org = '') {
  const name = repo.name || '';
  const desc = repo.description || '';
  if (name.startsWith('.') && name !== '.ui') return 'meta';
  if (org === 'eustasy-archive') return 'archived';
  if (STATUS_RE.eol.test(desc)) return 'eol';
  if (STATUS_RE.deprecated.test(desc)) return 'deprecated';
  if (STATUS_RE.alpha.test(desc)) return 'alpha';
  if (daysAgo(repo.pushedAt) < 30) return 'active';
  return 'stable';
}

// Strip any leading `TYPE:` prefix from descriptions so we don't double up.
export function cleanDescription(desc) {
  return (desc ?? '').replace(/^(EOL|DEPRECATED|ALPHA|TYPE|CSS-LIB|BASH|PHP-LIB|PYTHON|JS-LIB|JQUERY|JQ-LIB|STATIC|STATIC-SITE|SITE|CHROME-THEME|LAB|META)\s*[:.]\s*/i, '').trim();
}

export function repoOwnerName(fullName) {
  const idx = fullName.indexOf('/');
  return idx >= 0 ? fullName.slice(idx + 1) : fullName;
}

// Stable JSON output so identical data → identical bytes (avoid pointless
// commits during scheduled refreshes).
export function stableStringify(value) {
  return JSON.stringify(value, null, 2) + '\n';
}
