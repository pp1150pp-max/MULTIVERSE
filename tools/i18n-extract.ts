// Lists the Thai texts players can see, as dictionary keys (docs/systems/i18n.md): every Thai string in the player
// code, the shared data, the server's messages and index.html, cut the way the page shows it (one key per text
// between HTML tags, `${…}` → {0} {1} …, 'a' + x + 'b' → "a{0}b"). Run:
//   node --import tsx tools/i18n-extract.ts            → how many keys, how many still have no English
//   node --import tsx tools/i18n-extract.ts --missing  → the keys with no English, by file (JSON)
//   node --import tsx tools/i18n-extract.ts --all      → every key, by file (JSON)
import ts from 'typescript';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { hasThai, normKey } from '../src/shared/i18n/translator';
import { englishDict } from '../src/shared/i18n/dict';

const ROOT = join(import.meta.dirname, '..');

/** Not player-facing: the admin page, previews and tuning tools, logs, map files. */
const SKIP = [
  /^src\/admin\//, /^src\/dev\//, /^src\/client\/dev\//, /Preview\.ts$/, /Tune\.ts$/, /Tuning\.ts$/,
  /^src\/shared\/admin\.ts$/, /^src\/shared\/balance\.ts$/, /^src\/client\/i18n\.ts$/, /^src\/shared\/mapSchema\.ts$/, /^src\/shared\/mapDiff\.ts$/,
  /^server\/admin/, /^server\/.*-main\.ts$/, /^server\/(tunnel|control|backup|logfile|perf|add-news|direct)\.ts$/,
];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...files(rel));
    else if (rel.endsWith('.ts') && !SKIP.some((r) => r.test(rel))) out.push(rel);
  }
  return out;
}

/** One rendered text = one key: cut at HTML tags and entities' neighbours, keep the Thai pieces. */
function pieces(s: string): string[] {
  return s
    .split(/<[^>]*>/)
    .map((p) => p.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'))
    .map((p) => {
      // Placeholders renumbered from 0 in each piece.
      let i = 0;
      const map = new Map<string, string>();
      return normKey(p.replace(/\{(\d+)\}/g, (_, n: string) => {
        if (!map.has(n)) map.set(n, `{${i++}}`);
        return map.get(n)!;
      }));
    })
    .filter((p) => hasThai(p));
}

function fromTs(rel: string, add: (key: string) => void): void {
  const src = ts.createSourceFile(rel, readFileSync(join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true);
  const used = new Set<ts.Node>();
  const inConsole = (n: ts.Node): boolean => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText(src))) return true;
      if (ts.isImportDeclaration(p)) return true;
    }
    return false;
  };
  const visit = (n: ts.Node): void => {
    // 'a' + x + 'b' as one text (the outermost + only).
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && !(ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      const parts: ts.Expression[] = [];
      const flat = (e: ts.Expression): void => {
        if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
          flat(e.left);
          flat(e.right);
        } else parts.push(e);
      };
      flat(n);
      if (parts.some((p) => (ts.isStringLiteral(p) || ts.isNoSubstitutionTemplateLiteral(p)) && hasThai(p.text)) && !inConsole(n)) {
        let i = 0;
        const s = parts.map((p) => {
          if (ts.isStringLiteral(p) || ts.isNoSubstitutionTemplateLiteral(p)) {
            used.add(p);
            return p.text;
          }
          if (ts.isTemplateExpression(p)) {
            used.add(p);
            return p.head.text + p.templateSpans.map((sp) => `{${i++}}${sp.literal.text}`).join('');
          }
          return `{${i++}}`;
        }).join('');
        pieces(s).forEach(add);
      }
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !used.has(n) && hasThai(n.text) && !inConsole(n)) pieces(n.text).forEach(add);
    if (ts.isTemplateExpression(n) && !used.has(n) && !inConsole(n)) {
      const s = n.head.text + n.templateSpans.map((sp, i) => `{${i}}${sp.literal.text}`).join('');
      if (hasThai(s)) pieces(s).forEach(add);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}

function fromHtml(rel: string, add: (key: string) => void): void {
  const html = readFileSync(join(ROOT, rel), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  for (const m of html.matchAll(/\b(?:title|placeholder|aria-label|alt)="([^"]*)"/g)) if (hasThai(m[1]!)) add(normKey(m[1]!));
  pieces(html).forEach(add);
}

export function extract(): Map<string, Set<string>> {
  const byFile = new Map<string, Set<string>>();
  const list = [...files('src/client'), ...files('src/shared'), ...files('server'), 'src/main.ts'];
  for (const rel of list) {
    const set = new Set<string>();
    fromTs(rel, (k) => set.add(k));
    if (set.size) byFile.set(rel, set);
  }
  const html = new Set<string>();
  fromHtml('index.html', (k) => html.add(k));
  byFile.set('index.html', html);
  return byFile;
}

if (import.meta.main ?? process.argv[1]?.endsWith('i18n-extract.ts')) {
  const byFile = extract();
  const dict = new Map(Object.entries(englishDict()).map(([k, v]) => [normKey(k), v]));
  const mode = process.argv[2];
  const out: Record<string, string[]> = {};
  const all = new Set<string>();
  let missing = 0;
  for (const [f, keys] of byFile) {
    const list = [...keys].filter((k) => mode === '--all' || !dict.has(k));
    for (const k of keys) all.add(k);
    if (list.length) out[relative(ROOT, join(ROOT, f)).replace(/\\/g, '/')] = list;
  }
  for (const k of all) if (!dict.has(k)) missing++;
  if (mode === '--missing' || mode === '--all') console.log(JSON.stringify(out, null, 1));
  else console.log(`${all.size} Thai keys, ${missing} with no English (${dict.size} dictionary entries)`);
}
