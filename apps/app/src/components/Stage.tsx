import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { categoryLabel } from '../lib/verdict';
import type { Engine, VerdictKind } from '../lib/verdict';

interface Props {
  state: 'home' | 'wait' | 'verdict'; variant: VerdictKind; parts: [string, string];
  engines: Engine[]; children: ReactNode; onFile: (file: File) => void;
}
function Glyph({ parts }: { parts: [string, string] }) {
  return <><span className="l1">{parts[0]}</span><span className="l2">{parts[1]}<i className="bl" /></span></>;
}
export default function Stage({ state, variant, parts, engines, children, onFile }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLElement>(null);
  const glyph = useRef<HTMLDivElement>(null);
  const ribs = useRef<HTMLDivElement>(null);
  const haze = useRef<HTMLSpanElement>(null);
  const [selection, setSelection] = useState(-1);
  const [dragging, setDragging] = useState(false);
  const count = Math.max(70, engines.length);
  useLayoutEffect(() => {
    let alive = true;
    function layout() {
      if (!alive || !stage.current || !pane.current || !glyph.current || !ribs.current || !haze.current) return;
      const root = stage.current, g = glyph.current;
      const mobile = window.matchMedia('(max-width:640px)').matches;
      const pr = pane.current.getBoundingClientRect(), rr = ribs.current.getBoundingClientRect();
      const pad = mobile ? 16 : 40, avail = root.clientWidth - pad * 2;
      root.style.setProperty('--fs', '100px');
      let w100 = 0;
      const stacked = mobile || state === 'home';
      if (stacked) g.querySelectorAll('.l1,.l2').forEach(span => {
        const range = document.createRange(); range.selectNodeContents(span);
        w100 = Math.max(w100, range.getBoundingClientRect().width);
      });
      else w100 = g.getBoundingClientRect().width;
      const base = rr.bottom - (mobile ? 16 : 26);
      const fs = Math.max(1, Math.min(avail / Math.max(1, w100) * 100, (base - 58) / (stacked ? 1.6 : .76)));
      root.style.setProperty('--fs', `${fs.toFixed(1)}px`);
      g.style.top = '0px';
      const baseline = g.querySelector('.bl')?.getBoundingClientRect().top ?? 0;
      g.style.top = `${(base - baseline).toFixed(1)}px`;
      const width = rr.width / count, gr = g.getBoundingClientRect();
      const items = Array.from(ribs.current.querySelectorAll<HTMLElement>('.rib'));
      items.forEach((rib, i) => { rib.style.left = `${i * width}px`; rib.style.width = `${width + .4}px`; });
      g.style.clipPath = `inset(0 0 ${Math.max(0, gr.bottom - pr.top)}px 0)`;
      const fr = haze.current.parentElement!.getBoundingClientRect();
      haze.current.style.left = `${gr.left - fr.left}px`; haze.current.style.top = `${gr.top - fr.top}px`;
      const rects = items.map(rib => rib.getBoundingClientRect());
      items.forEach((rib, i) => {
        const clone = rib.querySelector<HTMLElement>('.g')!;
        const b = rects[i];
        clone.style.left = `${gr.left - b.left}px`; clone.style.top = `${gr.top - b.top}px`;
        clone.style.transformOrigin = `${b.left + width / 2 - gr.left}px 0`;
        clone.style.transform = 'scaleX(3)';
      });
      root.style.visibility = 'visible';
    }
    layout();
    const observer = new ResizeObserver(layout);
    if (stage.current) observer.observe(stage.current);
    if (pane.current) observer.observe(pane.current);
    void document.fonts.ready.then(layout);
    window.addEventListener('resize', layout);
    return () => { alive = false; observer.disconnect(); window.removeEventListener('resize', layout); };
  }, [state, parts[0], parts[1], count, variant]);
  useLayoutEffect(() => {
    setSelection(-1);
    const heading = pane.current?.querySelector<HTMLElement>('.flat h1');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }, [state]);
  const selected = state === 'verdict' ? engines[selection] : undefined;
  function selectAt(clientX: number) {
    if (state !== 'verdict' || !ribs.current) return;
    const rect = ribs.current.getBoundingClientRect();
    setSelection(Math.max(0, Math.min(count - 1, Math.floor((clientX - rect.left) / rect.width * count))));
  }
  return <div ref={stage} className="stage" data-state={state} data-v={variant}>
    <div ref={glyph} className="g" id="glyph" aria-hidden="true"><Glyph parts={parts} /></div>
    <main ref={pane} className={`pane${dragging ? ' drag' : ''}`}
      onDragOver={event => { event.preventDefault(); if (state === 'home') setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (state === 'home' && file) onFile(file); }}>
      <div className="frost" aria-hidden="true"><span ref={haze} className="g"><Glyph parts={parts} /></span></div>
      <div ref={ribs} className="ribs" tabIndex={state === 'verdict' ? 0 : undefined} role="group"
        aria-label="Resultado por motor, uno por cada motor. Flechas izquierda y derecha para leer cada uno."
        aria-describedby={state === 'verdict' ? 'readout' : undefined}
        onPointerMove={event => selectAt(event.clientX)} onPointerDown={event => selectAt(event.clientX)}
        onPointerLeave={event => { if (event.pointerType === 'mouse') setSelection(-1); }}
        onKeyDown={event => {
          if (state !== 'verdict') return;
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault(); setSelection(i => Math.max(0, Math.min(count - 1, i + (event.key === 'ArrowRight' ? 1 : -1))));
          } else if (event.key === 'Escape') setSelection(-1);
        }}>
        {Array.from({ length: count }, (_, i) => {
          const category = state === 'verdict' ? engines[i]?.category : '';
          const style = category === 'malicious' ? ' mal' : category === 'suspicious' ? ' sus'
            : state === 'verdict' && (!category || !['undetected', 'harmless'].includes(category)) ? ' uns' : '';
          return <i key={i} className={`rib${style}${state === 'verdict' && selection === i ? ' on' : ''}`} aria-hidden="true">
            <span className="lens"><span className="g"><Glyph parts={parts} /></span></span>
          </i>;
        })}
        <div className="wave" aria-hidden="true"><i /></div>
      </div>
      <div className="flat" key={state}>
        {children}
        {state === 'verdict' && <p className="readout" id="readout" aria-live="polite" aria-atomic="true">
          {selected ? <><b>{selected.name}</b> · {categoryLabel[selected.category] ?? selected.category}{selected.result ? ` · ${selected.result}` : ''}</>
            : selection >= engines.length && selection >= 0 ? 'Sin motor en esta posición.' : 'Toca o recorre la barra para ver qué dijo cada motor.'}
        </p>}
      </div>
    </main>
  </div>;
}
