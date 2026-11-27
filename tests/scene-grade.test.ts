// The light layer's settings (docs/systems/shaders.md, owner 2026-11-27): each map's tone, what the layer draws at each
// level, and what /admin stores.
import { applyBalance, balanceChanges, checkBalance, codeBalance, currentBalance, mergeBalance } from '../src/shared/balance';
import { GENERATED_ZONES } from '../src/shared/data/zones';
import { checkFxLayerTuning, codeFxLayer, fxLayerChanges, mergeFxLayer } from '../src/shared/fxLayerTuning';
import { codeSceneGrade, mistLook, postLook, sceneGradeOf, SHAFT_PEAK } from '../src/shared/sceneGrade';
import { finish, ok } from './check';

const cfg = codeFxLayer();
ok(cfg.shPost && cfg.shShafts && cfg.vignette === 0.22 && cfg.bossRoomPostK === 0.5, 'on in code, the numbers the owner picked');

const toned = Object.keys(GENERATED_ZONES).filter((id) => codeSceneGrade(id).tintK > 0).sort();
ok(toned.join() === 'emerald_forest,harbor_town,nexus_city,shipwreck_beach,smugglers_cove', `only the warm maps are toned (${toned})`);
ok(toned.every((id) => codeSceneGrade(id).shaft > 0) && Object.keys(GENERATED_ZONES).filter((id) => codeSceneGrade(id).shaft > 0).length === toned.length, 'shafts on the toned maps only');
ok(codeSceneGrade('nexus_city').shaft === 0.5 && codeSceneGrade('harbor_town').shaft === 0.5, 'the towns get faint shafts');
ok(codeSceneGrade('emerald_forest_room').tintK === 0 && codeSceneGrade('emerald_forest_room').shaft === 0, 'boss rooms start neutral');

const forest = codeSceneGrade('emerald_forest');
const low = postLook(1, cfg, forest, false)!;
const high = postLook(2, cfg, forest, false)!;
ok(low.vignette === 0.22 && low.tintK === 0.07 && low.shaft === SHAFT_PEAK && !low.streaks && !low.read, 'low: corners, tone, shafts, no screen copy');
ok(high.streaks && !high.read && high.tintK === low.tintK, 'high: streaks, the same tone, and no copy while colours are unchanged');
const vivid = { ...forest, saturation: 1.2, brightness: 0.9 };
ok(postLook(1, cfg, vivid, false)!.saturation === 1 && !postLook(1, cfg, vivid, false)!.read, 'low ignores colour strength and brightness');
ok(postLook(2, cfg, vivid, false)!.read && postLook(2, cfg, vivid, false)!.saturation === 1.2, 'high copies the screen to change them');

const room = postLook(2, cfg, codeSceneGrade('emerald_forest_room'), true)!;
ok(room.vignette === 0.11 && room.shaft === 0 && room.tintK === 0, 'boss room: half the corner shade, nothing else');
ok(postLook(2, { ...cfg, bossRoomPostK: 0 }, codeSceneGrade('emerald_forest_room'), true) === null, '×0 in rooms = nothing drawn');
ok(postLook(1, { ...cfg, shShafts: false }, forest, false)!.shaft === 0, 'shafts switched off');
ok(postLook(2, { ...cfg, vignette: 0 }, codeSceneGrade('misty_marsh'), false) === null, 'nothing to draw = no draw');
ok(postLook(2, { ...cfg, shaftK: 3 }, { ...forest, shaft: 2 }, false)!.shaft === 0.5, 'shafts never past half');

const marsh = { ...codeSceneGrade('misty_marsh'), mist: 1.5 };
ok(mistLook(0, 1, marsh, false).thick === 1 && mistLook(1, 1, marsh, false).flow === 0 && mistLook(1, 1, marsh, false).thick === 1, 'off and low keep the old mist');
ok(mistLook(2, 1, marsh, false).thick === 1.5 && mistLook(2, 1, marsh, false).flow === 1, 'high: thicker and streaming');
ok(mistLook(2, 1, marsh, true).thick === 1 && mistLook(2, 1, { ...marsh, mist: 0.5 }, true).thick === 0.5, 'boss rooms: never thicker');
ok(mistLook(2, 2, marsh, true).peak === 1 && mistLook(2, 2, marsh, true).flow === 1 && mistLook(2, 2, marsh, false).peak > 1, 'boss rooms: no ribbon thicker than the plain blob');

{
  const same = checkBalance({ sceneGrade: { emerald_forest: { tint: '#FFE59A', tintK: 0.07 }, misty_marsh: { mist: 1 } } }, true);
  ok(JSON.stringify(same.tuning) === '{}', `values equal to the code are not saved (${JSON.stringify(same)})`);
  const t = checkBalance({ sceneGrade: { smugglers_cove: { shaft: 0, tint: '#AABBCC', saturation: 1 } } }, true).tuning!;
  ok(JSON.stringify(t.sceneGrade) === '{"smugglers_cove":{"tint":"#aabbcc","shaft":0}}', `differences stored (${JSON.stringify(t.sceneGrade)})`);
  ok(sceneGradeOf('smugglers_cove', mergeBalance(t).sceneGrade).tintK === 0.16, 'the rest of that map stays as the code has it');
  ok(JSON.stringify(checkBalance(mergeBalance(t), true).tuning?.sceneGrade) === JSON.stringify(t.sceneGrade), "/admin's draft saves the same");
  ok(Object.keys(codeBalance().sceneGrade).length === 0, 'no overrides in code');
  ok('error' in checkBalance({ sceneGrade: { nowhere: { tintK: 0.1 } } }, true), 'an unknown map is refused');
  ok('error' in checkBalance({ sceneGrade: { toString: { tintK: 0.1 } } }, true), 'an inherited name is not a map');
  ok('error' in checkBalance({ sceneGrade: { emerald_forest: { tint: 'red' } } }, true), 'a colour must be #rrggbb');
  ok('error' in checkBalance({ sceneGrade: { emerald_forest: { tintK: 0.9 } } }, true), 'out of range is refused');
  ok('error' in checkBalance({ sceneGrade: { emerald_forest: { glow: 1 } } }, true), 'an unknown value is refused');
  ok(JSON.stringify(checkBalance({ sceneGrade: { nowhere: {}, emerald_forest: { tintK: 9, shaft: 0 } } }, false).tuning?.sceneGrade) === '{"emerald_forest":{"shaft":0}}', 'a stored tuning drops what is wrong');
  ok(balanceChanges({}, t).includes('โทนสีแมพ'), 'the audit names the change');
  applyBalance(t);
  ok(currentBalance().sceneGrade.smugglers_cove.shaft === 0, 'applied');
  applyBalance({});
}
{
  const t = checkFxLayerTuning({ shPost: false, shShafts: true, vignette: 0.22, shaftAngle: -20 }, true);
  const tu = 'tuning' in t ? t.tuning : undefined;
  ok(JSON.stringify(tu) === '{"shPost":false,"shaftAngle":-20}', `differences stored (${JSON.stringify(tu)})`);
  ok('error' in checkFxLayerTuning({ vignette: 0.9 }, true) && 'error' in checkFxLayerTuning({ bossRoomPostK: 2 }, true), 'out of range refused');
  ok(fxLayerChanges(cfg, mergeFxLayer(tu)).length === 2, 'audit lines');
}

finish('scene-grade');
