import { useState } from 'react';
import { DEFAULT_API_URL, getApiUrl, setApiUrl } from '../config';
import { clearHistory, loadHistory } from '../lib/history';
import { applyTheme, loadTheme } from '../lib/settings';
import type { Theme } from '../lib/settings';
import Page from './Page';

const themes: [Theme, string][] = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']];

export default function Settings() {
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [count, setCount] = useState(() => loadHistory().length);
  const [server, setServer] = useState(getApiUrl);
  const [serverMsg, setServerMsg] = useState('');
  function saveServer(value: string | null) {
    if (!setApiUrl(value)) { setServerMsg('Escribe una dirección válida con http:// o https://.'); return; }
    setServer(getApiUrl()); setServerMsg(value === null ? 'Se restableció la dirección de fábrica.' : 'Guardado.');
  }
  return <Page title="Ajustes">
    <section className="set" aria-labelledby="set-theme">
      <h2 id="set-theme">Tema</h2>
      <div className="seg" role="radiogroup" aria-labelledby="set-theme">
        {themes.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={theme === value} className="seg-item"
          onClick={() => { setTheme(value); applyTheme(value); }}>{label}</button>)}
      </div>
    </section>
    <section className="set" aria-labelledby="set-server">
      <h2 id="set-server">Servidor</h2>
      <form className="search-form" noValidate onSubmit={event => { event.preventDefault(); saveServer(server); }}>
        <label className="sr" htmlFor="server">Dirección del servidor</label>
        <input id="server" value={server} onChange={event => { setServer(event.currentTarget.value); setServerMsg(''); }}
          placeholder={DEFAULT_API_URL} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        <button className="btn pri" type="submit">Guardar</button>
        <button className="btn" type="button" onClick={() => saveServer(null)}>Restablecer</button>
      </form>
      <p className="hint" role="status">{serverMsg || `Dirección de fábrica: ${DEFAULT_API_URL}`}</p>
    </section>
    <section className="set" aria-labelledby="set-history">
      <h2 id="set-history">Historial</h2>
      <p className="hint">{count ? `${count} elementos guardados solo en este dispositivo.` : 'No hay elementos guardados.'}</p>
      <button className="btn" type="button" disabled={!count} onClick={() => { clearHistory(); setCount(0); }}>Borrar historial</button>
    </section>
  </Page>;
}
