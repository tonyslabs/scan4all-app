import type { ReactNode } from 'react';
import type { VerdictKind } from '../lib/verdict';

/** Contenedor desplazable para las pantallas fuera del escenario principal. */
export default function Page({ title, children, back, tone }: { title: string; children: ReactNode; tone?: VerdictKind; back?: { label: string; onBack: () => void } }) {
  return <main className="page" data-tone={tone}><div className="page-in">
    {back && <button className="btn back" type="button" onClick={back.onBack}>← {back.label}</button>}
    <h1 className="page-title" tabIndex={-1}>{title}</h1>
    {children}
  </div></main>;
}
