// Public link for friends: starts a Cloudflare Quick Tunnel (cloudflared) that forwards a random
// https://….trycloudflare.com address to this server. No account needed; the address changes every
// time the server starts. Friends only need a browser.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINK_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
/** Portable copy kept inside the project (git-ignored), downloaded on first use. */
const LOCAL_EXE = join(resolve(fileURLToPath(new URL('..', import.meta.url))), 'tools', 'bin', 'cloudflared.exe');
const DOWNLOAD_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

/** The project's own copy, or one installed with winget. */
function findCloudflared(): string | null {
  const installed = [
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'cloudflared', 'cloudflared.exe'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'cloudflared', 'cloudflared.exe'),
  ];
  return [LOCAL_EXE, ...installed].find((p) => existsSync(p)) ?? null;
}

/** Fetches Cloudflare's official Windows build into tools/bin (no installer, no admin rights). */
async function download(): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  try {
    console.log('  … ครั้งแรก: กำลังดาวน์โหลด cloudflared (โปรแกรมสร้างลิงก์ของ Cloudflare ~50 MB)');
    const res = await fetch(DOWNLOAD_URL);
    if (!res.ok) return null;
    mkdirSync(dirname(LOCAL_EXE), { recursive: true });
    writeFileSync(LOCAL_EXE, Buffer.from(await res.arrayBuffer()));
    return LOCAL_EXE;
  } catch {
    return null;
  }
}

/** Copies text to the Windows clipboard so the link can be pasted straight into chat. */
function copyToClipboard(text: string): boolean {
  if (process.platform !== 'win32') return false;
  try {
    const p = spawn('clip', [], { stdio: ['pipe', 'ignore', 'ignore'] });
    p.stdin.end(text);
    return true;
  } catch {
    return false;
  }
}

function announce(link: string): void {
  const copied = copyToClipboard(link);
  const line = '='.repeat(64);
  console.log(`\n${line}`);
  console.log('  🌐 ลิงก์สำหรับเพื่อน (กดแล้วเข้าเล่นได้เลย ไม่ต้องลงอะไร):');
  console.log(`\n     ${link}\n`);
  console.log(`  ${copied ? '📋 คัดลอกลิงก์ไว้แล้ว — กด Ctrl+V วางส่งเพื่อนได้เลย' : 'คัดลอกลิงก์ด้านบนส่งให้เพื่อน'}`);
  console.log('  ลิงก์นี้ใช้ได้จนกว่าจะปิด server — เปิดใหม่จะได้ลิงก์ใหม่');
  console.log(`${line}\n`);
}

/** Starts the tunnel (downloading cloudflared on first use); resolves to the child process (kill it on shutdown) or null when it can't start. */
export async function startTunnel(port: number): Promise<ChildProcess | null> {
  const exe = findCloudflared() ?? (await download());
  const help = () => {
    console.log('\n  ⚠ เปิดลิงก์สำหรับเพื่อนไม่ได้ เพราะหาโปรแกรม cloudflared ไม่เจอ และดาวน์โหลดไม่สำเร็จ');
    console.log('    เช็คอินเทอร์เน็ต แล้วรัน npm run online ใหม่ หรือติดตั้งเองด้วย: winget install Cloudflare.cloudflared\n');
  };
  if (!exe) {
    help();
    return null;
  }
  let found = false;
  let child: ChildProcess;
  try {
    child = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    help();
    return null;
  }
  const scan = (chunk: Buffer) => {
    if (found) return;
    const m = LINK_RE.exec(chunk.toString());
    if (m) {
      found = true;
      announce(m[0]);
    }
  };
  child.stdout?.on('data', scan);
  child.stderr?.on('data', scan);
  child.on('error', () => help());
  child.on('exit', (code) => {
    if (!found) console.log(`\n  ⚠ cloudflared ปิดตัวไป (code ${code}) — ลองรัน npm run online ใหม่อีกครั้ง\n`);
    else console.log('\n  ⚠ ลิงก์สำหรับเพื่อนปิดไปแล้ว (cloudflared หยุดทำงาน) — ปิด server แล้วรัน npm run online ใหม่\n');
  });
  setTimeout(() => {
    if (!found) console.log('  … กำลังสร้างลิงก์สำหรับเพื่อน (ปกติใช้ไม่เกิน 10 วินาที)');
  }, 4000);
  return child;
}
