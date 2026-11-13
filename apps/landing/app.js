import { detectPlatform, mapAssets, formatSize, parseParams, t } from './lib.js';

const LATEST_URL = 'https://github.com/tonyslabs/scan4all-app/releases/latest';
const API_URL = 'https://api.github.com/repos/tonyslabs/scan4all-app/releases/latest';
const CACHE_KEY = 'scan4all.release';
const LANG_KEY = 'scan4all.lang';
const params = parseParams(window.location.search);
let saved;
try { saved = localStorage.getItem(LANG_KEY); } catch {}
let lang = params.lang || (['es', 'en'].includes(saved) ? saved
  : /^en/i.test(navigator.language || '') ? 'en' : 'es');
let state = 'loading';
let release = { assets: {} };

function renderDownloads() {
  document.querySelectorAll('[data-downloads]').forEach(node => { node.dataset.state = state; });
  document.querySelectorAll('[data-asset]').forEach(node => {
    const asset = state === 'ready' ? release.assets[node.dataset.asset] : null;
    node.dataset.state = state === 'ready' && !asset ? 'soon' : state;
    node.href = asset?.url || LATEST_URL;
    node.querySelectorAll('[data-asset-size]').forEach(size => {
      size.textContent = asset ? formatSize(asset.size) : '';
    });
  });
  if (release.version) document.querySelectorAll('[data-app-version]').forEach(node => {
    node.textContent = release.version;
  });
  document.querySelectorAll('[data-dl-status]').forEach(node => {
    // En 'soon' los botones ya apuntan a la página de releases: no hace falta explicarlo.
    node.textContent = state === 'ready' || state === 'soon' ? '' : t(lang, `dl.${state}`);
  });
}

function applyLanguage(next) {
  lang = next === 'en' ? 'en' : 'es';
  document.documentElement.lang = lang;
  document.title = t(lang, 'meta.title');
  document.querySelectorAll('[data-i18n]').forEach(node => {
    node.textContent = t(lang, node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-attr]').forEach(node => {
    for (const pair of node.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(value => value.trim());
      if (attr && key) node.setAttribute(attr, t(lang, key));
    }
  });
  document.querySelectorAll('[data-lang]').forEach(node => {
    node.setAttribute('aria-pressed', String(node.dataset.lang === lang));
  });
  renderDownloads();
}

function showRelease(value) {
  if (!value || typeof value.tag_name !== 'string' || !value.tag_name.trim()
      || !Array.isArray(value.assets)) throw new Error('Invalid release');
  release = mapAssets(value);
  state = Object.keys(release.assets).length ? 'ready' : 'soon';
  renderDownloads();
}

async function loadRelease() {
  if (params.demo === '1') {
    showRelease({ tag_name: 'v1.0.0', assets: [
      ['Scan4All-1.0.0-android.apk', 8.7],
      ['Scan4All-1.0.0-linux-amd64.deb', 2.5],
      ['Scan4All-1.0.0-linux-x86_64.AppImage', 104],
      ['Scan4All-1.0.0-windows-x64-setup.exe', 1.6],
      ['SHA256SUMS.txt', 0.001],
    ].map(([name, mb]) => ({ name, size: Math.round(mb * 1024 ** 2),
      browser_download_url: `https://github.com/tonyslabs/scan4all-app/releases/download/v1.0.0/${name}` })) });
    return;
  }
  if (params.demo) { state = params.demo; renderDownloads(); return; }
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    if (cached) { showRelease(cached); return; }
  } catch {}
  const controller = new AbortController();
  let timeout;
  try {
    const expired = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Release timeout'));
      }, 8000);
    });
    const request = async () => {
      const response = await fetch(API_URL, { method: 'GET',
        headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Release request failed');
      return response.json();
    };
    const value = await Promise.race([request(), expired]);
    if (value === null) { state = 'soon'; renderDownloads(); return; }
    showRelease(value);
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch {}
  } catch {
    state = 'error';
    renderDownloads();
  } finally { clearTimeout(timeout); }
}

const platform = params.os || detectPlatform(navigator.userAgentData,
  `${navigator.userAgent || ''} ${navigator.platform || ''}`);
document.querySelectorAll('li[data-platform]').forEach(node => {
  if (node.dataset.platform === platform) node.dataset.current = 'true';
  else node.removeAttribute('data-current');
});
document.querySelectorAll('[data-lang]').forEach(button => {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch {}
  });
});
applyLanguage(lang);
if (params.lang) { try { localStorage.setItem(LANG_KEY, lang); } catch {} }
void loadRelease();
