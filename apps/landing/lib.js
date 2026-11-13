const assetPatterns = {
  'linux-deb': [/\.deb$/i],
  'linux-appimage': [/\.AppImage$/i],
  windows: [/setup.*\.exe$/i, /\.exe$/i],
  android: [/\.apk$/i],
  checksums: [/sha256sums/i],
};

export function detectPlatform(uaData, ua = '') {
  const classify = (value) => {
    if (/android/i.test(value)) return 'android';
    if (/iphone|ipad|ipod|mac|ios/i.test(value)) return null;
    if (/windows|win32|win64/i.test(value)) return 'windows';
    if (/linux|x11|cros/i.test(value)) return 'linux';
    return null;
  };
  const platform = typeof uaData === 'string' ? uaData : uaData?.platform;
  if (platform) {
    const detected = classify(platform);
    if (detected || /iphone|ipad|ipod|mac|ios/i.test(platform)) return detected;
  }
  return classify(ua);
}

export function mapAssets(releaseJson) {
  const assets = Array.isArray(releaseJson?.assets) ? releaseJson.assets : [];
  const usable = assets.filter((asset) => asset && typeof asset.name === 'string'
    && typeof asset.browser_download_url === 'string'
    && /^https:\/\//i.test(asset.browser_download_url)
    && Number.isFinite(asset.size) && asset.size >= 0);
  const mapped = {};
  for (const [slot, patterns] of Object.entries(assetPatterns)) {
    for (const pattern of patterns) {
      const asset = usable.find(({ name }) => pattern.test(name));
      if (asset) {
        mapped[slot] = { name: asset.name, url: asset.browser_download_url, size: asset.size };
        break;
      }
    }
  }
  return { version: releaseJson?.tag_name, assets: mapped };
}

export function formatSize(bytes) {
  const value = Number.isFinite(bytes) && bytes >= 0 ? bytes : 0;
  return `${(value / (1024 ** 2)).toFixed(1)} MB`;
}

export function parseParams(search = '') {
  const params = new URLSearchParams(search);
  const valid = (key, values) => values.includes(params.get(key)) ? params.get(key) : null;
  return {
    demo: valid('demo', ['1', 'loading', 'soon', 'error']),
    os: valid('os', ['android', 'linux', 'windows', 'none']),
    lang: valid('lang', ['es', 'en']),
  };
}

export const translations = Object.freeze({
es: Object.freeze({
  "nav.repo": "Repo",
  "hero.readout": "0 / 93 · sin detecciones",
  "hero.title": "Qué hay dentro, antes de abrirlo.",
  "hero.lede": "Archivos, URLs, dominios e IPs pasan por más de 90 motores. Tú decides con el panorama completo.",
  "cta.repo": "Ver el código",
  "cta.profile": "Más en @tonyslabs",
  "dl.title": "Descargas",
  "dl.deb": ".deb",
  "dl.windows": "Instalador",
  "dl.android": "APK",
  "meta.title": "scan4all — Qué hay dentro, antes de abrirlo",
  "meta.desc": "Escáner de archivos, URLs, dominios e IPs con más de 90 motores. Código abierto para Linux, Windows y Android.",
  "nav.label": "Enlaces",
  "lang.label": "Idioma",
  "dl.loading": "Buscando la última versión…",
  "dl.error": "No pude leer el release. Usa el enlace a GitHub."
}),
en: Object.freeze({
  "meta.title": "scan4all — See what's inside before you open it",
  "meta.desc": "File, URL, domain and IP scanner with 90+ engines. Open source for Linux, Windows and Android.",
  "nav.label": "Links",
  "nav.repo": "Repo",
  "lang.label": "Language",
  "hero.readout": "0 / 93 · no detections",
  "hero.title": "See what's inside, before you open it.",
  "hero.lede": "Files, URLs, domains and IPs go past 90+ engines. You decide, with the full picture.",
  "cta.repo": "See the code",
  "cta.profile": "More at @tonyslabs",
  "dl.title": "Downloads",
  "dl.deb": ".deb",
  "dl.windows": "Installer",
  "dl.android": "APK",
  "dl.loading": "Looking for the latest version…",
  "dl.error": "Couldn't read the release. Use the GitHub link."
})
});
export function t(lang, key) {
  return translations[lang === 'en' ? 'en' : 'es'][key] ?? key;
}
