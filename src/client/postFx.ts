// The full-screen light layer (docs/systems/shaders.md, plan 4): the shade in the corners, each map's tone and the
// slanting sun shafts, drawn over the finished picture after the scene's own render (no EffectComposer, so nothing the
// game already draws changes colour). Low: one sheet blended over the screen. High: noise streaks in the shafts, and
// where a map changes colour strength or brightness the screen is copied and redrawn. Off: nothing here touches the
// renderer. The screen holds sRGB values and these shaders work on them as they are: no colorspace_fragment.
import * as THREE from 'three';
import { currentBalance } from '../shared/balance';
import { postLook, sceneGradeOf } from '../shared/sceneGrade';
import type { ZoneDef } from '../shared/data/zones';
import { gfxPost } from './gfxPrefs';
import { frac, noiseTexture } from './waterFx';

/**
 * The sun shafts: where each crosses the screen (-1 … 1 of the way to its far corners), its half width (screen heights),
 * the seconds it takes to brighten and dim, and where in that it starts.
 */
const BANDS = [
  { at: -0.72, half: 0.1, period: 7.5, phase: 0 },
  { at: -0.28, half: 0.055, period: 9.4, phase: 2.1 },
  { at: 0.18, half: 0.135, period: 8.2, phase: 4.4 },
  { at: 0.68, half: 0.07, period: 6.4, phase: 1.2 },
];
/** The shafts' light is the map's tone lifted toward this warm white (0 = the tone itself). */
const WARM_WHITE = [1, 0.95, 0.8];
const WARM_SHARE = 0.4;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uTint, uShaftColor;
  uniform float uTintK, uVignette, uAspect, uStreak, uRead, uSaturation, uBrightness;
  uniform vec2 uAcross, uStreakShift;
  uniform vec3 uBands[${BANDS.length}];  // centre, half width, opacity
  uniform sampler2D uNoise, uScreen;
  varying vec2 vUv;

  // Lays one more translucent sheet over what is gathered so far (premultiplied). Only ever blends toward a colour,
  // so snow and white paper never burn out.
  void over(inout vec4 acc, vec3 colour, float a) {
    acc = vec4(colour * a + acc.rgb * (1.0 - a), a + acc.a * (1.0 - a));
  }

  void main() {
    vec4 acc = vec4(0.0);
    over(acc, uTint, uTintK);

    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
    float across = dot(p, uAcross);
    float clear = 1.0;
    for (int i = 0; i < ${BANDS.length}; i++) {
      vec3 b = uBands[i];
      clear *= 1.0 - (1.0 - smoothstep(b.y * 0.55, b.y, abs(across - b.x))) * b.z;
    }
    // Strongest at the top, where the light comes from.
    float shaft = (1.0 - clear) * mix(0.35, 1.0, vUv.y);
    if (uStreak > 0.5) {
      float along = dot(p, vec2(-uAcross.y, uAcross.x));
      float n = texture2D(uNoise, vec2(across * 2.3, along * 0.2) + uStreakShift).r;
      shaft *= 0.55 + n * 0.9;
    }
    over(acc, uShaftColor, shaft);

    // 1 in the corners, nothing over the middle of the screen.
    float r = length(vUv - 0.5) * 1.41421356;
    over(acc, vec3(0.0), smoothstep(0.45, 1.0, r) * uVignette);

    if (uRead > 0.5) {
      vec3 c = texture2D(uScreen, vUv).rgb;
      c = clamp(mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, uSaturation) * uBrightness, 0.0, 1.0);
      gl_FragColor = vec4(c * (1.0 - acc.a) + acc.rgb, 1.0);
    } else {
      gl_FragColor = acc;
    }
  }
`;

/** #rrggbb as the screen's own (sRGB) values; THREE.Color would turn it linear. */
const rgb = (hex: string, into: THREE.Vector3): THREE.Vector3 => {
  const n = parseInt(hex.slice(1), 16);
  return into.set((n >> 16) & 255, (n >> 8) & 255, n & 255).divideScalar(255);
};

export class PostFx {
  private readonly uniforms = {
    uTint: { value: new THREE.Vector3() }, uShaftColor: { value: new THREE.Vector3() },
    uTintK: { value: 0 }, uVignette: { value: 0 }, uAspect: { value: 1 }, uStreak: { value: 0 },
    uRead: { value: 0 }, uSaturation: { value: 1 }, uBrightness: { value: 1 },
    uAcross: { value: new THREE.Vector2(1, 0) }, uStreakShift: { value: new THREE.Vector2() },
    uBands: { value: BANDS.map(() => new THREE.Vector3()) },
    uNoise: { value: noiseTexture() }, uScreen: { value: null as THREE.Texture | null },
  };
  // One material for both levels, so changing level never builds a shader.
  private readonly material = new THREE.ShaderMaterial({
    uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    // Premultiplied "over"; the canvas keeps its own alpha.
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  /** The copy of the screen, only while a map's colours need it. */
  private screen: THREE.FramebufferTexture | null = null;
  private readonly size = new THREE.Vector2();
  /** Seconds of shaft time: added up, so changing /admin's speed doesn't make the light jump. */
  private t = 0;

  constructor() {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    sheet.frustumCulled = false;
    this.scene.add(sheet);
  }

  /**
   * Draws the layer over the frame just rendered. Everything is read each frame, so the player's setting and /admin
   * apply at once. `walk`: how far the camera has gone to the screen's right (world units).
   */
  draw(renderer: THREE.WebGLRenderer, zone: ZoneDef, dt: number, walk: number): void {
    const level = gfxPost();
    const balance = currentBalance();
    const cfg = balance.fxLayer;
    const look = level ? postLook(level, cfg, sceneGradeOf(zone.id, balance.sceneGrade), !!zone.roomOf) : null;
    if (!look?.read) this.release();
    if (!look) return;

    const u = this.uniforms;
    renderer.getDrawingBufferSize(this.size);
    const aspect = this.size.x / this.size.y;
    u.uAspect.value = aspect;
    rgb(look.tint, u.uTint.value);
    u.uShaftColor.value.set(WARM_WHITE[0], WARM_WHITE[1], WARM_WHITE[2]).lerp(u.uTint.value, 1 - WARM_SHARE);
    u.uTintK.value = look.tintK;
    u.uVignette.value = look.vignette;

    // The shafts lean `shaftAngle` from upright; `uAcross` points across them.
    this.t += dt * cfg.shaftSpeed;
    const lean = THREE.MathUtils.degToRad(cfg.shaftAngle);
    u.uAcross.value.set(Math.cos(lean), -Math.sin(lean));
    const reach = (aspect * Math.cos(lean) + Math.abs(Math.sin(lean))) / 2;
    BANDS.forEach((b, i) => {
      const wave = (this.t * Math.PI * 2) / b.period + b.phase;
      // A slow slide of its own, and a little with the player's steps.
      const slide = Math.sin(wave / 3) * 0.035 + Math.sin(walk * 0.07 + b.phase) * 0.05;
      u.uBands.value[i].set(b.at * reach + slide, b.half, look.shaft * (0.65 + 0.35 * Math.sin(wave)));
    });
    u.uStreak.value = look.streaks ? 1 : 0;
    u.uStreakShift.value.set(frac(this.t * 0.011), frac(this.t * 0.017));

    u.uRead.value = look.read ? 1 : 0;
    u.uSaturation.value = look.saturation;
    u.uBrightness.value = look.brightness;
    if (look.read) {
      if (!this.screen || this.screen.image.width !== this.size.x || this.screen.image.height !== this.size.y) {
        this.release();
        this.screen = new THREE.FramebufferTexture(this.size.x, this.size.y);
        u.uScreen.value = this.screen;
      }
      renderer.copyFramebufferToTexture(this.screen);
    }
    this.material.blending = look.read ? THREE.NoBlending : THREE.CustomBlending;

    const autoClear = renderer.autoClear;
    renderer.autoClear = false; // the picture under it stays
    renderer.render(this.scene, this.camera);
    renderer.autoClear = autoClear;
  }

  /** Frees the screen copy (level changed, or a map that doesn't need it). */
  private release(): void {
    if (!this.screen) return;
    this.screen.dispose();
    this.screen = null;
    this.uniforms.uScreen.value = null;
  }
}
