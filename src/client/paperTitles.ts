// Made by tools/cut_paper_extras.cjs: do not edit.
/** Measures of a paper title frame, in pixels of its files (sprites/paper/ui/<id>_<kind>{,_t,_b}.png). */
export interface PaperFrame {
  w: number;
  h: number;
  /** border-image-slice: top, right, bottom, left. */
  slice: [number, number, number, number];
  /** How far the art sticks out past the frame's plain edges: top, right, bottom, left. */
  outset: [number, number, number, number];
  /** The middle pieces drawn on top: width, top piece height, bottom piece height. */
  mid: [number, number, number];
  /** The frame body between its plain edges: width, height. */
  body: [number, number];
}
export const PAPER_TITLES: Record<string, { plate: PaperFrame; bubble: PaperFrame }> = {"title_flame":{"plate":{"w":219,"h":106,"slice":[57,87,37,87],"outset":[27,7,7,7],"mid":[114,57,37],"body":[380,72]},"bubble":{"w":235,"h":157,"slice":[60,91,78,91],"outset":[9,0,27,0],"mid":[131,60,78],"body":[435,121]}},"title_forest":{"plate":{"w":229,"h":88,"slice":[37,91,39,91],"outset":[7,7,9,7],"mid":[120,37,39],"body":[398,72]},"bubble":{"w":192,"h":152,"slice":[56,75,76,75],"outset":[6,3,26,3],"mid":[103,56,76],"body":[345,120]}},"title_gold":{"plate":{"w":213,"h":96,"slice":[51,84,34,84],"outset":[20,5,3,5],"mid":[113,51,34],"body":[375,73]},"bubble":{"w":203,"h":166,"slice":[73,79,73,79],"outset":[23,0,23,0],"mid":[113,73,73],"body":[375,120]}},"title_shadow":{"plate":{"w":222,"h":91,"slice":[46,90,34,90],"outset":[15,18,3,18],"mid":[103,46,34],"body":[345,73]},"bubble":{"w":220,"h":160,"slice":[65,88,75,88],"outset":[15,10,25,10],"mid":[111,65,75],"body":[371,120]}},"title_traveler":{"plate":{"w":235,"h":85,"slice":[37,92,36,93],"outset":[7,5,6,6],"mid":[125,37,36],"body":[415,72]},"bubble":{"w":188,"h":151,"slice":[54,73,77,74],"outset":[4,0,27,1],"mid":[104,54,77],"body":[346,120]}}};
