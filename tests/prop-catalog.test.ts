// The map editor's prop library (tools/build_prop_catalog.ts -> src/shared/data/propCatalog.json).
import fs from 'node:fs';
import { ok, finish } from './check';
import { buildCatalog, CATALOG_PATH, CATEGORIES, formatCatalog, sheetSpecProps, type PropCatalog } from '../tools/build_prop_catalog';

const committed = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) as PropCatalog;
const keys = new Set(committed.props.map((p) => p.key));
const specs = await sheetSpecProps();

ok(specs.size > 100, `SHEET_SPECS has props (${specs.size})`);
const missing = [...specs.keys()].filter((k) => !keys.has(k));
ok(missing.length === 0, `every prop in SHEET_SPECS is in the catalog${missing.length ? ': ' + missing.join(', ') : ''}`);
ok(keys.size === committed.props.length, 'no duplicate keys');
ok(committed.props.every((p) => (CATEGORIES as readonly string[]).includes(p.category)), 'every category is a known one');
ok(committed.props.every((p) => p.inSheetSpecs === specs.has(p.key)), 'inSheetSpecs matches SHEET_SPECS');
const sorted = [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
ok(sorted.every((k, i) => k === committed.props[i].key), 'keys are in a fixed order');
ok(committed.props.every((p) => (p.h === null) === (p.solid === null) && (p.h === null) === (p.hRange === null)), 'h, hRange and solid are null together');
ok(committed.faceSets.every((f) => (f.front === null || keys.has(f.front)) && (f.back === null || keys.has(f.back))), 'front/back sets name real keys');

// Reproducible: building again gives the committed file byte for byte (run tools/build_prop_catalog.ts after adding a picture).
const again = formatCatalog(await buildCatalog());
ok(again === fs.readFileSync(CATALOG_PATH, 'utf8'), 'propCatalog.json is up to date (rerun tools/build_prop_catalog.ts)');
finish('prop-catalog');
