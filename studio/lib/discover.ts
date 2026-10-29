export type AssetKind = 'landscape' | 'portrait' | 'logo' | 'banner';
export type Side = 'A' | 'B';
export type Scene = 'discover' | 'portrait' | 'detail' | 'banner' | 'capture';
export type Asset = { src: string; name: string; width: number; height: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Lab = {
  title: string; creator: string; active: Side; scene: Scene;
  packs: Record<Side, Partial<Record<AssetKind, Asset>>>;
  neighbors: Asset[]; capture?: Asset; rect: Rect;
  captureKind: AssetKind; position: number; row: number;
  overlays: boolean; guides: boolean; logo: boolean; fit: 'cover' | 'contain';
  focusX: number; focusY: number; radius: number; bannerRatio: number;
};
export const assetLabels: Record<AssetKind, string> = { landscape: 'Horizontal', portrait: 'Portrait', logo: 'Logo', banner: 'A-Spot' };
export const sceneLabels: Record<Scene, string> = { discover: 'Discover', portrait: 'Top 10', detail: 'Ficha de isla', banner: 'A-Spot', capture: 'Tu captura' };
export const freshLab = (): Lab => ({ title: 'MI PRÓXIMA ISLA', creator: 'Tu estudio', active: 'A', scene: 'discover', packs: { A: {}, B: {} }, neighbors: [], rect: { x: .36, y: .2, w: .24, h: .24 }, captureKind: 'landscape', position: 2, row: 0, overlays: true, guides: false, logo: false, fit: 'cover', focusX: .5, focusY: .5, radius: 12, bannerRatio: 4 });
const bounded = (v: unknown, min: number, max: number, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
export function clampRect(r: Rect): Rect {
  const w = bounded(r.w, .01, 1, .24), h = bounded(r.h, .01, 1, .24);
  return { x: bounded(r.x, 0, 1 - w, 0), y: bounded(r.y, 0, 1 - h, 0), w, h };
}
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  const x = Math.max(0, Math.min(1, Math.min(a.x, b.x))), y = Math.max(0, Math.min(1, Math.min(a.y, b.y)));
  return clampRect({ x, y, w: Math.min(1, Math.max(a.x, b.x)) - x, h: Math.min(1, Math.max(a.y, b.y)) - y });
}
export function fitImage(iw: number, ih: number, r: Rect, fit: 'cover' | 'contain', fx = .5, fy = .5) {
  const scale = (fit === 'cover' ? Math.max : Math.min)(r.w / iw, r.h / ih);
  const w = iw * scale, h = ih * scale;
  return { x: r.x + (r.w - w) * fx, y: r.y + (r.h - h) * fy, w, h };
}
export function readLab(raw: unknown): Lab {
  const r = raw as Partial<Lab>; if (!r || typeof r !== 'object' || !r.packs) throw new Error('Esta copia no es un escenario de Discover Lab.');
  const b = freshLab();
  function asset(a: any): Asset | undefined {
    if (!a) return;
    if (typeof a.src !== 'string' || a.src.length > 8500000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.src) || !Number.isFinite(a.width) || !Number.isFinite(a.height) || a.width < 1 || a.height < 1 || a.width * a.height > 64000000) throw new Error('La copia contiene una imagen incompatible.');
    return { src: a.src, name: String(a.name || 'Imagen').slice(0, 120), width: a.width, height: a.height };
  }
  for (const s of ['A', 'B'] as Side[]) for (const k of Object.keys(assetLabels) as AssetKind[]) { const a = asset(r.packs?.[s]?.[k]); if (a) b.packs[s][k] = a; }
  b.title = typeof r.title === 'string' ? r.title.slice(0, 65) : b.title;
  b.creator = typeof r.creator === 'string' ? r.creator.slice(0, 35) : b.creator;
  b.active = r.active === 'B' ? 'B' : 'A'; b.scene = r.scene && Object.hasOwn(sceneLabels,r.scene) ? r.scene : b.scene;
  b.neighbors = Array.isArray(r.neighbors) ? r.neighbors.slice(0, 12).map(asset).filter((a): a is Asset => !!a) : [];
  b.capture = asset(r.capture); b.rect = clampRect(r.rect || b.rect);
  b.captureKind = r.captureKind && Object.hasOwn(assetLabels,r.captureKind) ? r.captureKind : 'landscape';
  b.position = Math.floor(bounded(r.position, 0, 6, 2)); b.row = Math.floor(bounded(r.row, 0, 2, 0));
  for (const k of ['overlays', 'guides', 'logo'] as const) if (typeof r[k] === 'boolean') b[k] = r[k];
  b.fit = r.fit === 'contain' ? 'contain' : 'cover';
  b.focusX = bounded(r.focusX, 0, 1, .5); b.focusY = bounded(r.focusY, 0, 1, .5); b.radius = bounded(r.radius, 0, 60, 12); b.bannerRatio = r.bannerRatio === 5 ? 5 : 4;
  const total = [...Object.values(b.packs.A),...Object.values(b.packs.B),...b.neighbors,b.capture].reduce((sum,a)=>sum+(a?.src.length||0),0);
  if(total>32000000) throw new Error('El escenario supera 32 MB. Reducí tus imágenes o quitá referencias antes de agregar más.');
  return b;
}
export function expectedRatio(kind: AssetKind) { return { landscape: 16 / 9, portrait: 3 / 4, logo: 1440 / 608, banner: 4 }[kind]; }
export function ratioWarning(a: Asset | undefined, kind: AssetKind) { return !!a && kind !== 'banner' && Math.abs(a.width / a.height - expectedRatio(kind)) > .025; }

let db: Promise<IDBDatabase> | undefined;
function storage() { return db ||= new Promise((resolve, reject) => { const r = indexedDB.open('thumbnail-discover-lab', 1); r.onupgradeneeded = () => r.result.createObjectStore('scenes'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
export async function saveLab(lab: Lab) { const d = await storage(); return new Promise<void>((resolve, reject) => { const tx = d.transaction('scenes', 'readwrite'); tx.objectStore('scenes').put(lab, 'current'); tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error); }); }
export async function loadLab(): Promise<Lab | null> { const d = await storage(); return new Promise((resolve, reject) => { const r = d.transaction('scenes').objectStore('scenes').get('current'); r.onsuccess = () => { try { resolve(r.result ? readLab(r.result) : null); } catch (e) { reject(e); } }; r.onerror = () => reject(r.error); }); }
