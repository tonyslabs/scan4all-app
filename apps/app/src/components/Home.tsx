import { useRef } from 'react';
import { MAX_UPLOAD_MB } from '../config';
interface Props { url: string; setUrl: (value: string) => void; onUrl: () => void; onFile: (file: File) => void; error: string }
export default function Home({ url, setUrl, onUrl, onFile, error }: Props) {
  const input = useRef<HTMLInputElement>(null);
  return <section className="view v-home" aria-label="Inicio">
    <div className="msg"><h1><span className="only-d">Suelta un archivo aquí.</span><span className="only-m">Elige qué analizar.</span></h1>
      <form className="url" noValidate onSubmit={event => { event.preventDefault(); onUrl(); }}>
        <label className="sr" htmlFor="url">URL, dominio, IP o hash</label>
        <input id="url" type="text" inputMode="url" value={url} onChange={event => setUrl(event.currentTarget.value)}
          placeholder="o pega una URL, dominio, IP o hash" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          aria-invalid={Boolean(error)} aria-describedby={error ? 'input-error' : undefined} />
        <button className="btn" type="submit">Analizar</button>
      </form>
      {error && <p className="error" id="input-error" role="alert">{error}</p>}
    </div>
    <div className="act"><input ref={input} type="file" hidden aria-label="Archivo para analizar" onChange={event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onFile(file);
    }} /><button className="btn pri" type="button" onClick={() => input.current?.click()}>Elegir archivo</button></div>
    <p className="foot">Archivos de hasta {MAX_UPLOAD_MB} MB o URLs. Puede tardar unos minutos.</p>
  </section>;
}
