// "หน้า login แบบใหม่" (/admin switch Balance.loginLook, docs/systems/world-and-ui.md): the title / login screens in
// the landing page's look (src/styles/login-new.css). The switch is known before login only from GET /api/lang, so the
// last answer is remembered in this browser and used for the first frame; the fresh answer then corrects it.
import { CODE_LOGIN_LOOK } from '../shared/balance';

const KEY = 'multiverse-login-look';

function remembered(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? CODE_LOGIN_LOOK : v === '1';
  } catch {
    return CODE_LOGIN_LOOK;
  }
}

function apply(on: boolean): void {
  document.getElementById('menu')?.classList.toggle('login-new', on);
}

/** Call once at boot, before the menu shows. */
export function startLoginLook(): void {
  apply(remembered());
}

/** The server's answer (from the /api/lang request); undefined = an older server, keep what we had. */
export function setLoginLook(on: boolean | undefined): void {
  if (typeof on !== 'boolean') return;
  apply(on);
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // storage blocked: this page only
  }
}
