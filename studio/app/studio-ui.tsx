'use client';
import { useState, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronDown, Columns2, Copy, Eye, Grid2X2, ImagePlus, Maximize2, Minus, Plus, ScanLine, Sun, X, ZoomIn } from 'lucide-react';
import { type Variant, pct } from '@/lib/studio';
import { localReview } from '@/lib/core';

export function Dropzone({ onPick, onFile, label = 'Arrastrá tu miniatura', compact = false, letter }: { onPick: () => void; onFile: (f: File) => void; label?: string; compact?: boolean; letter?: string }) {
  const [over, setOver] = useState(false);
  return <button type="button" className={'dropzone ' + (compact ? 'compact ' : '') + (over ? 'over' : '')} onClick={onPick} onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
    <span className="drop-icon">{letter ? <b>{letter}</b> : <ImagePlus size={30} strokeWidth={1.5} />}</span><strong>{label}</strong><span>Elegir archivo <ArrowRight size={16} /></span><small>PNG, JPG o WebP · hasta 10 MB</small>
  </button>;
}

export function ImageStage({ variant, onExpand }: { variant: Variant; onExpand: () => void }) {
  const [gray, setGray] = useState(false), [grid, setGrid] = useState(false), [small, setSmall] = useState(false);
  return <section className="stage-panel">
    <div className="stage-toolbar"><span className="stage-name">{variant.name}</span><div className="tool-group">
      <button className={gray ? 'active' : ''} onClick={() => setGray(!gray)} aria-pressed={gray} title="Escala de grises"><Sun size={17} /><span>Grises</span></button>
      <button className={grid ? 'active' : ''} onClick={() => setGrid(!grid)} aria-pressed={grid} title="Guía de tercios"><Grid2X2 size={17} /><span>Guías</span></button>
      <button className={small ? 'active' : ''} onClick={() => setSmall(!small)} aria-pressed={small} title="Lectura a 160 píxeles"><Eye size={17} /><span>160 px</span></button>
      <button onClick={onExpand} title="Ampliar imagen" aria-label="Ampliar imagen"><Maximize2 size={18} /></button>
    </div></div>
    <div className={'image-canvas ' + (small ? 'small-canvas' : '')}><div className="stage-image" style={small ? { width: 160 } : undefined}><img src={variant.src} alt={variant.name} className={gray ? 'grayscale' : ''} />{grid && <div className="thirds" />}</div>{small && <span className="small-label">160 px · ¿se entiende sin ampliar?</span>}</div>
    <div className="stage-caption"><span>{variant.width} × {variant.height} px de origen</span><span>Vista de trabajo</span></div>
  </section>;
}

export function MetricsDetails({ variant, onNotice }: { variant: Variant; onNotice: (s: string) => void }) {
  return <details className="details-panel"><summary><span><ScanLine size={17} /> Ver métricas de imagen</span><ChevronDown size={17} /></summary><div className="details-body">
    <div className="metric-grid">{[['brightness', 'Brillo'], ['contrast', 'Contraste'], ['saturation', 'Saturación'], ['edges', 'Bordes']].map(([k, label]) => <div key={k}><span>{label}</span><strong>{pct(variant.metrics[k as 'brightness'])}</strong><div className="metric-track"><i style={{ width: Math.min(100, variant.metrics[k as 'brightness']) + '%' }} /></div></div>)}</div>
    <p className="fine-print">Describen los píxeles. No son una nota de calidad ni una estimación de CTR.</p>
    <div className="palette-row">{variant.metrics.palette.map((p, i) => <button key={i} title={'Copiar ' + p.color} aria-label={'Copiar color ' + p.color} onClick={() => navigator.clipboard.writeText(p.color).then(() => onNotice(p.color + ' copiado.')).catch(() => onNotice(p.color))}><i style={{ background: p.color }} /><span>{p.color.toUpperCase()}</span></button>)}</div>
    <details className="text-details"><summary>Cómo se calculan</summary><p className="fine-print">{variant.metrics.method}. El contraste es global; no evalúa la separación de un objeto del fondo.</p></details>
  </div></details>;
}

export function LocalReview({ variant }: { variant: Variant }) {
  return <div className="local-review"><div className="section-label">GUÍA DE LECTURA · SIN IA</div><h2>Empezá por lo que se ve.</h2>{localReview(variant.metrics, variant.width, variant.height).map((r, i) => <div className="review-point" key={r.title}><span>{String(i + 1).padStart(2, '0')}</span><div><h3>{r.title}</h3><p>{r.body}</p></div></div>)}</div>;
}

export function CompareCanvas({ a, b }: { a: Variant; b: Variant }) {
  const [mode, setMode] = useState('side'), [split, setSplit] = useState(50), [gray, setGray] = useState(false), [showB, setShowB] = useState(false);
  const sameRatio = Math.abs(a.width / a.height - b.width / b.height) < .02;
  const shown = mode === 'slider' && !sameRatio ? 'side' : mode;
  return <section className="comparison-canvas"><div className="compare-toolbar"><div className="segmented" aria-label="Vista de comparación">{[['side', 'Lado a lado'], ['slider', 'Deslizar'], ['small', '160 px'], ['flip', 'Alternar']].map(([id, label]) => <button key={id} disabled={id === 'slider' && !sameRatio} title={id === 'slider' && !sameRatio ? 'El deslizador requiere la misma proporción.' : label} className={shown === id ? 'active' : ''} aria-pressed={shown === id} onClick={() => setMode(id)}>{label}</button>)}</div><button className={'quiet-button ' + (gray ? 'is-active' : '')} aria-pressed={gray} onClick={() => setGray(!gray)}><Sun size={16} /> Grises</button></div>
    {shown === 'slider' ? <div className="slider-wrap"><div className={'slider-images ' + (gray ? 'grayscale' : '')} style={{ aspectRatio: a.width / a.height }}>
      <img src={b.src} alt={'B: ' + b.name} /><img src={a.src} alt={'A: ' + a.name} style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
      <span className="image-badge">A</span><span className="image-badge right">B</span><div className="split-line" style={{ left: split + '%' }}><span><Columns2 size={18} /></span></div>
    </div><label className="slider-control">División A/B<input aria-label="División de comparación A y B" type="range" min="0" max="100" value={split} onChange={e => setSplit(+e.target.value)} /></label></div> : shown === 'flip' ? <div className="flip-wrap"><div className="flip-image"><img className={gray ? 'grayscale' : ''} src={showB ? b.src : a.src} alt={showB ? b.name : a.name} /><span className="image-badge">{showB ? 'B' : 'A'}</span></div><button className="secondary" onClick={() => setShowB(!showB)}>Ver variante {showB ? 'A' : 'B'} <ArrowRight size={16} /></button></div> : <div className={'compare-images ' + (shown === 'small' ? 'at-small' : '')}>{[a, b].map((v, i) => <div key={i}><div className="compare-image"><img src={v.src} alt={(i ? 'B: ' : 'A: ') + v.name} className={gray ? 'grayscale' : ''} /><span className={'image-badge ' + (i ? 'cyan' : '')}>{i ? 'B' : 'A'}</span></div><span className="compare-caption">{shown === 'small' ? '160 px · ' : ''}{v.name}</span></div>)}</div>}
    {!sameRatio && <p className="fine-print canvas-note">Las proporciones son distintas. La vista conserva cada encuadre.</p>}
  </section>;
}

export function ZoomViewer({ variant, onClose }: { variant: Variant; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  return <div className="zoom-viewer"><div className="zoom-toolbar"><strong>{variant.name}</strong><div className="tool-group"><button onClick={() => setZoom(z => Math.max(.5, z - .25))} aria-label="Alejar"><Minus size={20} /></button><span>{Math.round(zoom * 100)} %</span><button onClick={() => setZoom(z => Math.min(3, z + .25))} aria-label="Acercar"><Plus size={20} /></button><button onClick={() => setZoom(1)}>Ajustar</button><button autoFocus onClick={onClose} aria-label="Cerrar imagen"><X size={22} /></button></div></div><div className="zoom-scroll"><img src={variant.src} alt={variant.name} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} /></div><p className="fine-print">Usá el desplazamiento para recorrer la imagen ampliada.</p></div>;
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{text}</p>{action}</div>;
}
