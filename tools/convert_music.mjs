// Turns raw songs in art_templates/music/raw/ into the game's looping files, public/assets/music/<name>.mp3.
// Needs ffmpeg on PATH. See art_templates/music/BOSS_GOTHIC.md.
//
//   node tools/convert_music.mjs                     every file in raw/
//   node tools/convert_music.mjs <name> [--start=4] [--end=140] [--fade=3] [--kbps=128]
//
// Silence at both ends is trimmed, the last <fade> seconds are crossfaded into the first ones (so the loop has
// no seam: the file ends exactly where its own beginning picks up) and the loudness is set to −18 LUFS.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW = join(ROOT, 'art_templates', 'music', 'raw');
const OUT = join(ROOT, 'public', 'assets', 'music');
const AUDIO = ['.mp3', '.wav', '.ogg', '.flac', '.m4a'];

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  if (!a) return fallback;
  const n = Number(a.slice(name.length + 3));
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} ต้องเป็นตัวเลข`);
  return n;
};
const start = opt('start', 0);
const end = opt('end', 0);
const fade = opt('fade', 3);
const kbps = opt('kbps', 128);
if (!only && (start || end)) throw new Error('--start / --end ใช้กับเพลงเดียว: ใส่ชื่อเพลงด้วย');

const files = (existsSync(RAW) ? readdirSync(RAW) : [])
  .filter((f) => AUDIO.includes(extname(f).toLowerCase()))
  .filter((f) => !only || basename(f, extname(f)) === only);
if (!files.length) {
  console.error(`ไม่พบไฟล์เพลง${only ? ` "${only}"` : ''} ใน ${RAW}`);
  process.exit(1);
}

const ffmpeg = (a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'mv-music-'));
try {
  for (const f of files) {
    const name = basename(f, extname(f));
    const cut = join(tmp, `${name}.wav`);
    // Trim silence at the start, then (reversed) at the end.
    const trim = 'silenceremove=start_periods=1:start_threshold=-50dB';
    ffmpeg([...(start ? ['-ss', String(start)] : []), ...(end ? ['-to', String(end)] : []), '-i', join(RAW, f),
      '-vn', '-af', `${trim},areverse,${trim},areverse`, '-ar', '48000', '-ac', '2', cut]);
    const len = seconds(cut);
    if (len <= fade * 3) throw new Error(`${f}: สั้นเกินไป (${len.toFixed(1)} วิ)`);
    const loop = join(tmp, `${name}-loop.wav`);
    if (fade > 0) {
      // [tail fading into head] + [everything between them].
      ffmpeg(['-i', cut, '-filter_complex',
        `[0:a]asplit=3[a][b][c];[a]atrim=start=${len - fade},asetpts=PTS-STARTPTS[tail];` +
        `[b]atrim=end=${fade},asetpts=PTS-STARTPTS[head];[c]atrim=start=${fade}:end=${len - fade},asetpts=PTS-STARTPTS[mid];` +
        `[tail][head]acrossfade=d=${fade}:c1=qsin:c2=qsin[join];[join][mid]concat=n=2:v=0:a=1[out]`,
        '-map', '[out]', loop]);
    }
    const out = join(OUT, `${name}.mp3`);
    ffmpeg(['-i', fade > 0 ? loop : cut, '-af', 'loudnorm=I=-18:TP=-2:LRA=11', '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', `${kbps}k`, '-map_metadata', '-1', out]);
    console.log(`${f} → public/assets/music/${name}.mp3 · ${seconds(out).toFixed(1)} วิ · ${(statSync(out).size / 1024 / 1024).toFixed(1)} MB`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
