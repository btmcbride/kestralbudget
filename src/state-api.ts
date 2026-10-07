import { demoSeed } from './demo-seed.js';

type StatePayload = { budgets: unknown[]; active: string | null; preferences: Record<string, unknown> };

export const IS_DEMO = import.meta.env.MODE === 'demo';
const DEMO_KEY = 'kestral-demo-state.v1';

export async function fetchState(): Promise<Response> {
  if (!IS_DEMO) return fetch('/api/state');
  let stored: string | null = null;
  try { stored = localStorage.getItem(DEMO_KEY); } catch { /* storage blocked */ }
  const payload = stored ? JSON.parse(stored) : demoSeed();
  return new Response(JSON.stringify({ ...payload, initialized: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function sendState(body: string): Promise<{ ok: boolean; status: number }> {
  if (!IS_DEMO) {
    return fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
  }
  try { localStorage.setItem(DEMO_KEY, body); } catch { /* demo keeps working in memory */ }
  return { ok: true, status: 200 };
}

export function installDemoBanner(): void {
  if (!IS_DEMO) return;
  const bar = document.createElement('div');
  bar.setAttribute('role', 'note');
  bar.id = 'demo-banner';
  const style = document.createElement('style');
  style.textContent = '#demo-banner{position:fixed;top:0;left:0;right:0;z-index:1000;height:44px;overflow:hidden}body{padding-top:44px}@media(min-width:721px){.app-shell{min-height:calc(100vh - 44px)}.sidebar{top:44px;height:calc(100vh - 44px)}}@media(max-width:720px){#demo-banner{position:static;height:auto;padding:.5rem 1rem!important}#demo-banner span{display:none}body{padding-top:0}}';
  document.head.append(style);
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;justify-content:center;padding:0 1rem;background:#0d419d;color:#fff;font:14px/1.4 system-ui,sans-serif;text-align:center';
  bar.innerHTML = '<strong>Live demo</strong><span>Sample data, saved only in this browser. Nothing is sent anywhere.</span>'
    + '<a href="/" style="color:#fff">Back to site</a><a href="/#download" style="color:#fff">Download</a>'
    + '<button type="button" style="background:#fff;color:#0d419d;border:0;border-radius:6px;padding:.25rem .7rem;cursor:pointer;font:inherit">Reset demo</button>';
  bar.querySelector('button')!.addEventListener('click', () => {
    try { localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
    location.reload();
  });
  document.body.prepend(bar);
  const updateBannerHeight = () => document.body.style.setProperty('--demo-banner-height', `${bar.getBoundingClientRect().height}px`);
  updateBannerHeight();
  new ResizeObserver(updateBannerHeight).observe(bar);
}
