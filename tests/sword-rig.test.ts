// The papercraft sword rig (owner 2026-11-16): the bone maths, reading rig.json, the item → picture pairing
// that /admin saves in the balance tuning, and the real rig.json in public/ reading cleanly with every piece there.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ok, finish } from './check';
import {
  angleDelta, blendPose, boneOrder, parseRig, partCenter, sampleKeys, samplePose, solveView, viewFor, type RigViewDef,
} from '../src/client/rig/rigMath';
import { allRigParts, rigPartPath } from '../src/client/rig/rigLook';
import {
  checkRigLookTuning, codeRigLook, mergeRigLook, RIG_ARMOR_ITEMS, RIG_WEAPON_ITEMS, rigLookChanges, rigLookOf,
} from '../src/shared/rigLookTuning';
import { checkBalance, mergeBalance } from '../src/shared/balance';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// ---------------------------------------------------------------- bones
{
  // A 100×100 "torso" with its pivot at the bottom middle, and a 20×60 "arm" hanging from its top-left corner.
  const view: RigViewDef = {
    root: [0, 50],
    order: ['torso', 'arm'],
    bones: [
      { id: 'arm', parent: 'torso', at: [0, 0], pivot: [0.5, 0] },
      { id: 'torso', pivot: [0.5, 1] },
    ],
  };
  const sizes = (p: string) => (p === 'torso' ? { w: 100, h: 100 } : { w: 20, h: 60 });
  ok(boneOrder(view.bones).map((b) => b.id).join() === 'torso,arm', 'parents come before children');

  const rest = solveView(view, sizes);
  const arm = rest.get('arm')!;
  ok(near(arm.x, -50) && near(arm.y, 150) && arm.rot === 0, `at rest the arm hangs from the torso's top-left (${arm.x}, ${arm.y})`);
  const c = partCenter(view.bones[0], arm, sizes('arm'));
  ok(near(c[0], -50) && near(c[1], 120), `the arm picture's centre is 30 px below its pivot (${c})`);

  const bent = solveView(view, sizes, { torso: 90 }, [5, 0]);
  const t = bent.get('torso')!;
  const a2 = bent.get('arm')!;
  ok(near(t.x, 5) && near(t.y, 50), 'the body move shifts the root');
  ok(near(a2.x, 5 - 100) && near(a2.y, 50 - 50) && a2.rot === 90, `turning the torso 90° swings the arm with it (${a2.x}, ${a2.y}, ${a2.rot})`);

  let threw = false;
  try {
    boneOrder([{ id: 'a', parent: 'b', at: [0, 0], pivot: [0, 0] }, { id: 'b', parent: 'a', at: [0, 0], pivot: [0, 0] }]);
  } catch {
    threw = true;
  }
  ok(threw, 'a loop of parents is refused');
}

// ---------------------------------------------------------------- keys
{
  ok(angleDelta(170, -170) === 20 && angleDelta(-170, 170) === -20 && angleDelta(0, 180) === 180, 'angles take the shortest turn');
  const keys = [{ t: 0, r: 0, e: 'linear' as const }, { t: 0.5, r: 10, e: 'linear' as const }];
  ok(sampleKeys(keys, 0.25, false, (k) => k.r) === 5, 'halfway between two keys');
  ok(sampleKeys(keys, 0.9, false, (k) => k.r) === 10, 'after the last key (not looping) it stays there');
  ok(sampleKeys(keys, 0.75, true, (k) => k.r) === 5, 'looping goes back to the first key over the rest of the cycle');
  ok(sampleKeys(keys, 1.25, true, (k) => k.r) === 5, 'looping wraps time past 1');
  const smooth = [{ t: 0, r: 0 }, { t: 1, r: 10 }];
  ok(near(sampleKeys(smooth, 0.5, false, (k) => k.r), 5) && sampleKeys(smooth, 0.1, false, (k) => k.r) < 1, 'smooth easing starts slowly');
  ok(sampleKeys([{ t: 0, r: 7 }], 0.6, true, (k) => k.r) === 7, 'a single key holds');
  const b = blendPose({ pose: { a: 0 }, move: [0, 0] }, { pose: { a: 20, b: 10 }, move: [10, 4] }, 0.5);
  ok(b.pose.a === 10 && b.pose.b === 5 && b.move[0] === 5 && b.move[1] === 2, 'blending two poses halfway');
}

// ---------------------------------------------------------------- facing
{
  ok(viewFor(0, -1).view === 'front' && !viewFor(0, -1).mirror, 'toward the camera: front, as drawn');
  ok(viewFor(-1, -0.5).view === 'front' && !viewFor(-1, -0.5).mirror, 'down-left: front, as drawn (the pieces face left)');
  ok(viewFor(1, -0.5).mirror, 'down-right: front, mirrored');
  ok(viewFor(-1, 1).view === 'back' && !viewFor(-1, 1).mirror && viewFor(1, 1).mirror, 'away: back view, mirrored when right');
}

// ---------------------------------------------------------------- reading rig files
{
  const good = () => ({
    version: 1,
    pxPerUnit: 280,
    views: {
      front: { root: [0, 0], order: ['hips'], bones: [{ id: 'hips', pivot: [0.5, 0.5] }] },
      back: { root: [0, 0], order: ['hips'], bones: [{ id: 'hips', pivot: [0.5, 0.5] }] },
    },
    anims: { idle: { duration: 1, loop: true, tracks: { hips: [{ t: 0, r: 0 }, { t: 0.5, r: 3, e: 'out' }] }, root: [{ t: 0, x: 0, y: 1 }] } },
  });
  ok(parseRig(good()).anims.idle.tracks.hips[1].e === 'out', 'a good rig file reads');
  const bad = (what: string, change: (r: any) => void) => {
    const r = good();
    change(r);
    let msg = '';
    try {
      parseRig(r);
    } catch (e) {
      msg = (e as Error).message;
    }
    ok(msg !== '', `refused: ${what} (${msg})`);
  };
  bad('a wrong version', (r) => (r.version = 2));
  bad('a missing view', (r) => delete r.views.back);
  bad('two roots', (r) => r.views.front.bones.push({ id: 'b', pivot: [0, 0] }));
  bad('a child with no joint', (r) => r.views.front.bones.push({ id: 'b', parent: 'hips', pivot: [0, 0] }));
  bad('a missing parent', (r) => r.views.front.bones.push({ id: 'b', parent: 'nope', at: [0, 0], pivot: [0, 0] }));
  bad('an unknown bone in the draw order', (r) => r.views.front.order.push('ghost'));
  bad('a track for an unknown bone', (r) => (r.anims.idle.tracks.ghost = [{ t: 0, r: 0 }]));
  bad('keys out of time order', (r) => (r.anims.idle.tracks.hips = [{ t: 0.5, r: 0 }, { t: 0.2, r: 0 }]));
  bad('a key past the end', (r) => (r.anims.idle.tracks.hips = [{ t: 1.5, r: 0 }]));
  bad('an unknown easing', (r) => (r.anims.idle.tracks.hips[0].e = 'bouncy'));
  bad('a zero duration', (r) => (r.anims.idle.duration = 0));
  bad('a bad picture name', (r) => (r.views.front.bones[0].part = '../x'));
}

// ---------------------------------------------------------------- the real rig in public/
{
  const dir = join(ROOT, 'public/assets/sprites/player/sword_rig');
  const rig = parseRig(JSON.parse(readFileSync(join(dir, 'rig.json'), 'utf8')));
  ok(['idle', 'run', 'attack', 'attack_2', 'attack_3'].every((a) => a in rig.anims), 'idle, run and the three attacks are there');
  ok(rig.anims.idle.loop && rig.anims.run.loop && !rig.anims.attack.loop, 'idle and run loop, attacks play once');
  const parts = new Set(Object.values(rig.views).flatMap((v) => v.bones.map((b) => b.part ?? b.id)));
  const missing = allRigParts(parts).filter((p) => {
    if (existsSync(join(dir, p + '.png'))) return false;
    // A piece an armour does not replace falls back to the dark set (RigActor.texFor).
    return !existsSync(join(dir, p.replace(/_(silver)\//, '/') + '.png'));
  });
  ok(missing.length === 0, `every piece of every view, armour and sword has a picture (${missing.join(', ') || 'none missing'})`);
  ok(rigPartPath('front', 'sword', 'silver', 'fire') === 'weapons/fire' && rigPartPath('back', 'head', 'silver', 'katana') === 'back/head'
    && rigPartPath('front', 'torso', 'silver', 'katana') === 'front_silver/torso', 'armour swaps the body pieces, the sword swaps the sword');
  const sizes: Record<string, { w: number; h: number }> = JSON.parse(readFileSync(join(dir, 'sizes.json'), 'utf8'));
  for (const view of ['front', 'back'] as const) {
    const v = rig.views[view];
    for (const name of Object.keys(rig.anims)) {
      const { pose, move } = samplePose(rig.anims[name], 0);
      const solved = solveView(v, (p) => sizes[rigPartPath(view, p, 'dark', 'katana')], pose, move);
      const allNumbers = [...solved.values()].every((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.rot));
      if (!allNumbers) ok(false, `${view} ${name}: a bone came out as NaN`);
    }
    const rest = solveView(v, (p) => sizes[rigPartPath(view, p, 'dark', 'katana')]);
    const head = rest.get('head')!;
    ok(head.y > 220 && head.y < 450, `${view}: the head sits at body height (${Math.round(head.y)} px)`);
  }
}

// ---------------------------------------------------------------- item → picture pairing (/admin, balance tuning)
{
  const code = codeRigLook();
  ok(RIG_WEAPON_ITEMS.length >= 3 && RIG_WEAPON_ITEMS.every((id) => id in code.weapons), 'every weapon kind has a sword picture');
  ok(RIG_ARMOR_ITEMS.every((id) => id in code.armors), 'every armour kind has an armour picture');
  ok(code.weapons[RIG_WEAPON_ITEMS[0]] === 'katana' && code.weapons[RIG_WEAPON_ITEMS.at(-1)!] === 'fire', 'lowest weapons are the katana, highest the fire sword');
  ok(rigLookOf(code, undefined, undefined).weapon === 'katana' && rigLookOf(code, 'nope', 'nope').armor === 'dark', 'nothing worn or unknown: the defaults');

  const w = RIG_WEAPON_ITEMS[0];
  const c = checkRigLookTuning({ weapons: { [w]: 'great', [RIG_WEAPON_ITEMS[1]]: code.weapons[RIG_WEAPON_ITEMS[1]] } }, true);
  ok('tuning' in c && JSON.stringify(c.tuning) === JSON.stringify({ weapons: { [w]: 'great' } }), `only differences are kept (${JSON.stringify(c)})`);
  ok('error' in checkRigLookTuning({ weapons: { nope: 'great' } }, true), 'an unknown item is refused');
  ok('error' in checkRigLookTuning({ armors: { [RIG_ARMOR_ITEMS[0]]: 'gold' } }, true), 'an unknown picture is refused');
  const loose = checkRigLookTuning({ weapons: { nope: 'great', [w]: 'fire' } }, false);
  ok('tuning' in loose && JSON.stringify(loose.tuning) === JSON.stringify({ weapons: { [w]: 'fire' } }), 'read back from the database: bad entries dropped');
  const merged = mergeRigLook({ weapons: { [w]: 'great' } });
  ok(merged.weapons[w] === 'great' && rigLookChanges(code, merged).length === 1, 'merged over the code, and one audit line');

  const bal = checkBalance({ rigLook: { armors: { [RIG_ARMOR_ITEMS[0]]: 'silver' } } }, true);
  ok('tuning' in bal && mergeBalance(bal.tuning!).rigLook.armors[RIG_ARMOR_ITEMS[0]] === 'silver', 'saved inside the balance tuning');
  ok(JSON.stringify(mergeBalance({}).rigLook) === JSON.stringify(code), 'the balance carries the code pairing');
}

finish('sword-rig');
