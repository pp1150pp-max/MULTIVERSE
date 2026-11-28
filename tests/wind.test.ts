// The wind (owner 2026-11-28, docs/systems/shaders.md): which level moves what, what sways, the shader edits fitting
// three.js's own shaders, and the /admin values. How it looks needs a screen and is looked at in the game.
import { existsSync } from 'node:fs';
import * as THREE from 'three';
import { ok, finish } from './check';
import { SHIP_ROCK, SWAY_PROPS, windLook } from '../src/client/swayTable';
import { Wind } from '../src/client/wind';
import { DECOR } from '../src/shared/groundLook';
import { checkFxLayerTuning, codeFxLayer, fxLayerChanges, mergeFxLayer } from '../src/shared/fxLayerTuning';

const code = codeFxLayer();

// Levels: off = nothing moves, low = trees only, high = trees, grass and ships.
{
  ok(code.shWind && code.windK === 1 && code.windSpeed === 1 && code.windDir === 0 && code.swayTree === 1 && code.swayGrass === 1 && code.swayShip === 1, 'on in code');
  const off = windLook(0, code);
  ok(off.tree === 0 && off.grass === 0 && off.ship === 0, 'off: all still');
  const low = windLook(1, code);
  ok(low.tree === 1 && low.grass === 0 && low.ship === 0, 'low: trees only');
  const high = windLook(2, code);
  ok(high.tree === 1 && high.grass === 1 && high.ship === SHIP_ROCK, 'high: trees, grass and ships');
  ok(Math.abs((SHIP_ROCK * 180) / Math.PI - 0.5) < 1e-9, 'ships rock ±0.5°');
  const strong = windLook(2, { windK: 2, swayTree: 0.5, swayGrass: 1.5, swayShip: 0 });
  ok(strong.tree === 1 && strong.grass === 3 && strong.ship === 0, 'the strength multiplies each kind');
}

// What sways has a picture; flags, sails, rocks and buildings do not sway.
{
  const lost = Object.keys(SWAY_PROPS).filter((k) => !existsSync(`public/assets/sprites/paper/props/${k}.png`));
  ok(lost.length === 0, `every swaying prop has a picture (${lost.join(', ')})`);
  for (const k of ['tree_0', 'snow_pine_2', 'thicket_1', 'charred_tree', 'sea_kelp', 'hb_ship_red']) ok(!!SWAY_PROPS[k], `${k} sways`);
  for (const k of ['flag', 'kraken_flag', 'torn_sail_mast', 'hb_bunting_post', 'rock_0', 'burnt_pillar_0', 'stump', 'tent']) ok(!SWAY_PROPS[k], `${k} stands still`);
  for (const [theme, d] of Object.entries(DECOR)) {
    ok(d.sway.length > 0 && d.sway.every((c) => c >= 0 && c < d.cols * d.rows && !d.flat?.includes(c)), `${theme}: swaying details are standing cells`);
  }
}

// The shader edits find their places in three.js's shaders, and every angle stays within one turn.
{
  const wind = new Wind(new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2));
  const compile = (mat: THREE.Material, vertexShader: string) => {
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader, fragmentShader: '' };
    mat.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, null as unknown as THREE.WebGLRenderer);
    return shader;
  };
  for (const kind of ['leaf', 'ship'] as const) {
    const mat = new THREE.SpriteMaterial();
    wind.sprite(mat, kind);
    const s = compile(mat, THREE.ShaderLib.sprite.vertexShader);
    ok(s.vertexShader.indexOf('uSway != 0.0') > 0 && s.vertexShader.indexOf('uSway != 0.0') < s.vertexShader.indexOf('vec2 rotatedPosition;'), `${kind}: moved before the sprite turns`);
    ok(s.uniforms.uSway === wind.sway[kind], `${kind}: its own amplitude`);
  }
  const quads = new THREE.MeshBasicMaterial();
  wind.quads(quads);
  const q = compile(quads, THREE.ShaderLib.basic.vertexShader);
  ok(q.vertexShader.includes('attribute vec3 aWind;') && q.vertexShader.indexOf('transformed.xz +=') > q.vertexShader.indexOf('#include <begin_vertex>'), 'grass: moved after the position is read');
  const keys = [new THREE.SpriteMaterial(), new THREE.SpriteMaterial()];
  wind.sprite(keys[0], 'leaf');
  wind.sprite(keys[1], 'ship');
  ok(keys[0].customProgramCacheKey() !== keys[1].customProgramCacheKey(), 'leaning and rocking compile apart');

  ok(Object.values(wind.sway).every((u) => u.value === 0), 'still before the first frame');
  wind.update(1000, 2, code);
  ok(Object.values(wind.sway).every((u) => u.value > 0), 'high moves everything');
  const angles = ['uWindSwell', 'uWindFlutter', 'uWindRoll'].map((k) => q.uniforms[k].value as number);
  ok(angles.every((a) => a >= 0 && a < Math.PI * 2), `angles within a turn (${angles.join(', ')})`);
  wind.update(0.016, 0, code);
  ok(Object.values(wind.sway).every((u) => u.value === 0), 'off puts every amplitude back to exactly 0');
}

// /admin: only differences kept, ranges checked.
{
  const t = checkFxLayerTuning({ shWind: false, windK: 1, windSpeed: 0.5, windDir: 180, swayShip: 2 }, true);
  const tu = 'tuning' in t ? t.tuning : undefined;
  ok(JSON.stringify(tu) === '{"shWind":false,"windSpeed":0.5,"windDir":180,"swayShip":2}', `differences stored (${JSON.stringify(tu)})`);
  for (const bad of [{ windK: -1 }, { windSpeed: 4 }, { windDir: 400 }, { swayGrass: 9 }, { shWind: 1 }]) {
    ok('error' in checkFxLayerTuning(bad, true), `refused ${JSON.stringify(bad)}`);
  }
  ok(fxLayerChanges(code, mergeFxLayer(tu)).join(' | ').includes('ลม: ต้นไม้ หญ้า ไหว และเรือโคลง (shader) เปิด → ปิด'), 'audit line');
}

finish('wind');
