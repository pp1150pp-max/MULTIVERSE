// When a treasure chest comes up again (owner 2026-11-28, docs/systems/chests-shrines.md): an unopened one stays where it is for
// good (no timer, no second copy), also when its channel closes, the layout is rebuilt or published again, a map preview runs or
// the server restarts; an opened one is back chestRespawn s later (10 minutes) at a new spot, counting on across a restart.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Channels, type ChestKeeper, type ChestSave } from '../server/channels';
import { Db } from '../server/db';
import { applyBalance, currentBalance } from '../src/shared/balance';
import { chestGround } from '../src/shared/chestSpots';
import { ZONES, type ZoneDef } from '../src/shared/data/zones';
import type { MapChest } from '../src/shared/mapSchema';
import type { Sim } from '../src/shared/sim/Sim';
import { Terrain } from '../src/shared/sim/terrain';
import { codeTreasure } from '../src/shared/treasure';
import { finish, ok } from './check';

const cfg = codeTreasure();
const zone = ZONES.emerald_forest;
const ids = zone.chests!.map((c) => c.id);
const text = (x: unknown) => JSON.stringify(x);
const dist = (a: MapChest, b: MapChest) => Math.hypot(a.x - b.x, a.z - b.z);
const idle = () => ({ move: null, moveTo: null, aim: { x: 0, z: 0 }, basic: false, skills: [], dash: false, potion: null });

let now = 1_000_000_000;
const later = (sec: number) => (now += sec * 1000);

/** The database's part, in memory: what a restart reads back has been through JSON like the real thing. */
function memory(): ChestKeeper & { rows: Map<string, string>; writes: number } {
  const rows = new Map<string, string>();
  return {
    rows,
    writes: 0,
    load: (key) => (rows.has(key) ? (JSON.parse(rows.get(key)!) as ChestSave) : undefined),
    save(key, state) {
      this.writes++;
      rows.set(key, JSON.stringify(state));
    },
  };
}
/** A server's channels (a new object = a restarted server); `edit` stands for the layout as published now. */
const server = (keeper?: ChestKeeper, edit: () => ZoneDef = () => zone) => new Channels([zone], () => now, undefined, edit, undefined, keeper);

function open(sim: Sim, id: string): void {
  const p = sim.addPlayer({ name: 'O', classId: 'sword', level: 5, exp: 0, gold: 0, equipment: {}, bag: [] });
  const c = sim.chests.find((x) => x.id === id)!;
  p.x = c.x;
  p.z = c.z + 1;
  sim.openChest(p, c);
  sim.removePlayer(p);
}
/** All four are there once each, and exactly where `was` says. */
const unmoved = (sim: Sim, was: string) => text(sim.chestsShown()) === was && new Set(sim.chestsShown().map((c) => c.id)).size === ids.length;

applyBalance({});
ok(cfg.chestRespawn === 600 && cfg.keepOnRestart, 'code values: back 10 minutes after being opened, kept across a restart');

// ---- unopened: nothing ever moves or doubles it
{
  const keeper = memory();
  let layout: ZoneDef = zone;
  const ch = server(keeper, () => layout);
  let sim = ch.ensure(zone.id, 1)!.sim;
  const was = text(sim.chestsShown());
  ok(sim.chestsShown().length === 4, 'four chests to start');
  const writes = keeper.writes;
  let steady = true;
  for (let i = 0; i < 200; i++) {
    later(3600);
    sim.monsters = [];
    sim.step(0.1, idle);
    steady &&= unmoved(sim, was);
  }
  ok(steady, '200 hours unopened: the same four at the same spots');
  ok(keeper.writes === writes, `and nothing written meanwhile (${keeper.writes - writes})`);
  ch.sweep();
  sim = ch.ensure(zone.id, 1)!.sim;
  ok(unmoved(sim, was), 'the empty channel closed and opened again');
  layout = { ...zone };
  ch.sweep();
  applyBalance({ treasure: { chestRespawn: 60 } });
  ok(unmoved(ch.ensure(zone.id, 1)!.sim, was), 'a balance save that rebuilds the zone');
  applyBalance({});
  // A map preview of a changed draft searches the ground of the same map id in between.
  const draft: ZoneDef = { ...zone, start: { x: zone.start.x - 4, z: zone.start.z } };
  chestGround(draft, new Terrain(draft));
  ch.sweep();
  ok(unmoved(ch.ensure(zone.id, 1)!.sim, was), 'a map-editor preview of a changed draft ran: the real chests stay');
  layout = draft;
  ch.sweep();
  sim = ch.ensure(zone.id, 1)!.sim;
  ok(sim.zone === draft && unmoved(sim, was), 'a changed layout published, their spots still good: they stay');
  applyBalance({ treasure: { randomSpots: false } });
  ok(text(sim.chestsShown()) === text(zone.chests), 'random spots off: the pins');
  applyBalance({});
  ok(unmoved(sim, was), 'on again: back where they were');

  // Water published over one chest: that one moves, the others stay.
  const [first, ...others] = JSON.parse(was) as MapChest[];
  layout = { ...draft, iceLakes: [{ x: first.x, z: first.z, rx: 2, rz: 2 }] };
  ch.sweep();
  sim = ch.ensure(zone.id, 1)!.sim;
  const nowAt = sim.chestsShown();
  ok(nowAt.length === 4 && dist(nowAt[0], first) > 2 && text(nowAt.slice(1)) === text(others), 'a layout that covers one spot: only that chest moves');
  ok(chestGround(sim.zone, sim.terrain).some((s) => s.x === nowAt[0].x && s.z === nowAt[0].z), 'onto ground where a chest may stand');
  ok(text(keeper.load(`${zone.id}:1`)!.spots.find(([id]) => id === first.id)![1]) === text({ x: nowAt[0].x, z: nowAt[0].z, opened: false }), 'and the new spot is saved');
}

// ---- opened: back after the delay, at one new good spot, once
for (const wait of [600, 1200]) {
  applyBalance(wait === 600 ? {} : { treasure: { chestRespawn: wait } });
  const sim = server(memory()).ensure(zone.id, 1)!.sim;
  const before = sim.chestsShown();
  const old = before[0];
  open(sim, old.id);
  const rest = text(before.slice(1));
  ok(sim.chestsShown().length === 3 && text(sim.chestsShown()) === rest, `${wait} s: opened, three left where they were`);
  later(wait - 1);
  ok(!sim.chestHere(old.id) && text(sim.chestsShown()) === rest, `${wait} s: still gone one second early`);
  later(1);
  const after = sim.chestsShown();
  const back = after.find((c) => c.id === old.id)!;
  ok(after.length === 4 && new Set(after.map((c) => c.id)).size === 4 && sim.chests.length === 4, `${wait} s: back, four again and no extra one`);
  ok(text(after.slice(1)) === rest, `${wait} s: the others did not move`);
  ok(chestGround(sim.zone, sim.terrain).some((s) => s.x === back.x && s.z === back.z), `${wait} s: on ground where a chest may stand`);
  const gap = currentBalance().treasure.spotGap;
  ok(after.slice(1).every((c) => dist(back, c) >= gap) && dist(back, old) >= gap, `${wait} s: a new spot, away from the old one and the others`);
  later(86400);
  ok(text(sim.chestsShown()) === text(after), `${wait} s: and there it stays`);
}
applyBalance({});

// ---- a restarted server
{
  const keeper = memory();
  const a = server(keeper).ensure(zone.id, 1)!.sim;
  const old = a.chestsShown()[0];
  const rest = text(a.chestsShown().slice(1));
  open(a, old.id);
  later(200);
  const b = server(keeper).ensure(zone.id, 1)!.sim;
  ok(a !== b && text(b.chestsShown()) === rest, 'restart: the unopened three where they were, the opened one still gone');
  ok(Math.abs(b.chestBackIn(old.id) - 400) < 1e-6, `restart: it counts on (${b.chestBackIn(old.id)} s left of 600)`);
  later(400);
  const back = b.chestsShown().find((c) => c.id === old.id);
  ok(back && dist(back, old) >= cfg.spotGap && text(b.chestsShown().slice(1)) === rest, 'back on time, somewhere else');
  // Opened, and its time passes while the server is down.
  const second = b.chestsShown()[1];
  open(b, second.id);
  const kept = text(b.chestsShown());
  later(5000);
  const c = server(keeper).ensure(zone.id, 1)!.sim;
  const all = c.chestsShown();
  ok(all.length === 4 && dist(all[1], second) >= cfg.spotGap && text(all.filter((x) => x.id !== second.id)) === kept, 'down past its time: back at a new spot, the others unmoved');
  // Each channel has its own row.
  const two = server(keeper).ensure(zone.id, 2)!.sim;
  ok(two.chestsShown().length === 4 && text(two.chestsShown()) !== text(all), 'another channel has its own chests');
  ok(keeper.rows.size === 2 && text(server(keeper).ensure(zone.id, 2)!.sim.chestsShown()) === text(two.chestsShown()), 'saved per channel');
  // The /admin switch off: a restart starts over.
  open(c, ids[0]);
  applyBalance({ treasure: { keepOnRestart: false } });
  const d = server(keeper).ensure(zone.id, 1)!.sim;
  ok(d.chestsShown().length === 4 && d.chestHere(ids[0]), 'switch off: a restart brings every chest back');
  applyBalance({});
}

// ---- the database
{
  const dir = mkdtempSync(join(tmpdir(), 'multiverse-test-'));
  const file = join(dir, 'test.db');
  try {
    let db = new Db(file);
    const keeper: ChestKeeper = { load: (k) => db.chestState(k), save: (k, s) => db.setChestState(k, s) };
    const a = server(keeper).ensure(zone.id, 1)!.sim;
    a.chestsShown();
    open(a, ids[0]);
    const rest = text(a.chestsShown());
    db.close();
    db = new Db(file);
    const b = server(keeper).ensure(zone.id, 1)!.sim;
    ok(text(b.chestsShown()) === rest && !b.chestHere(ids[0]), 'through the database file: same spots, the opened one still gone');
    ok(db.chestState('nowhere:1') === undefined, 'nothing saved: undefined');
    db.setChestState('bad:1', { gone: [['c1', 5], ['c2', 'x' as never]], spots: [['c1', { x: 1, z: 2, opened: false }], ['c2', null as never]] });
    ok(text(db.chestState('bad:1')) === text({ gone: [['c1', 5]], spots: [['c1', { x: 1, z: 2, opened: false }]] }), 'bad entries are dropped');
    db.setChestState('bad:2', {} as never);
    ok(db.chestState('bad:2') === undefined, 'an unreadable row counts as none');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

finish('chest-respawn');
