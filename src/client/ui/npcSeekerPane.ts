// The Seeker inside the NPC talk window (owner 2026-11-28, same as the other NPCs): his quest window (quests.ts: boss
// key quests and gear quests, moved in as it is) takes the whole width under the medallion and the speech bubble;
// nothing is picked from the bag. "ฟังเรื่องราว" stays an answer of the talk window itself.
// Switch: currentBalance().npcTalk.seekerPane (off = the old window). Browser only.
import type { Game } from '../Game';
import { NpcHostPane, type HostPaneSpec } from './npcHostPane';

export function npcSeekerPane(g: Game, say: (text: string) => void): NpcHostPane {
  const spec: HostPaneSpec = {
    kind: 'seeker',
    hostId: 'quest-win',
    title: 'ภารกิจ',
    bagTitle: '',
    views: [],
    hint: () => '',
    designW: 400,
    cell: () => ({ usable: false, tip: '' }),
    click: () => undefined,
    sig: () => '',
  };
  return new NpcHostPane(g, say, spec);
}
