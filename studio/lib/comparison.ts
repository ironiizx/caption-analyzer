export type Comparison = {
  recommendation: 'A' | 'B' | 'tie';
  summary: string;
  reasons: { title: string; a: string; b: string }[];
  improvements: { variant: 'A' | 'B'; action: string }[];
  hypothesis: string;
  limitations: string;
};

export const comparisonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    recommendation: { type: 'string', enum: ['A', 'B', 'tie'] },
    summary: { type: 'string' },
    reasons: { type: 'array', minItems: 1, maxItems: 3, items: {
      type: 'object', additionalProperties: false,
      properties: { title: { type: 'string' }, a: { type: 'string' }, b: { type: 'string' } },
      required: ['title', 'a', 'b'],
    } },
    improvements: { type: 'array', maxItems: 3, items: {
      type: 'object', additionalProperties: false,
      properties: { variant: { type: 'string', enum: ['A', 'B'] }, action: { type: 'string' } },
      required: ['variant', 'action'],
    } },
    hypothesis: { type: 'string' }, limitations: { type: 'string' },
  }, required: ['recommendation', 'summary', 'reasons', 'improvements', 'hypothesis', 'limitations'],
};

export function validateComparison(a: unknown): Comparison {
  const c = a as Comparison;
  if (!c || !['A', 'B', 'tie'].includes(c.recommendation)
    || ['summary', 'hypothesis', 'limitations'].some(k => typeof c[k as keyof Comparison] !== 'string')
    || !Array.isArray(c.reasons) || c.reasons.length < 1 || c.reasons.length > 3
    || c.reasons.some(r => !r || ['title', 'a', 'b'].some(k => typeof r[k as keyof typeof r] !== 'string'))
    || !Array.isArray(c.improvements) || c.improvements.length > 3
    || c.improvements.some(r => !r || !['A', 'B'].includes(r.variant) || typeof r.action !== 'string')) {
    throw new Error('La comparación no tiene un formato válido.');
  }
  return c;
}

export function parseComparison(response: any): Comparison {
  if (response.status !== 'completed') throw new Error('La comparación no se completó.');
  const text = response.output?.flatMap((m: any) => m.content || [])
    .filter((c: any) => c.type === 'output_text').map((c: any) => c.text).join('') || '';
  return validateComparison(JSON.parse(text));
}

export type Signature = { grid: number[]; width: 12; height: 8 };

// A coarse RGB grid, not an Epic similarity detector or a semantic model.
export function imageSignature(rgba: ArrayLike<number>, width: number, height: number): Signature {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4) throw new Error('Imagen inválida.');
  const sums = new Float64Array(12 * 8 * 3), counts = new Uint32Array(12 * 8);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cell = Math.min(7, Math.floor(y * 8 / height)) * 12 + Math.min(11, Math.floor(x * 12 / width));
    const at = (y * width + x) * 4, alpha = rgba[at + 3] / 255;
    counts[cell]++;
    for (let c = 0; c < 3; c++) sums[cell * 3 + c] += rgba[at + c] * alpha + 255 * (1 - alpha);
  }
  return { grid: Array.from(sums, (v, i) => Math.round(v / (counts[Math.floor(i / 3)] || 1))), width: 12, height: 8 };
}

export function predictionTiming(createdAt: string, testStart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testStart) || !Number.isFinite(Date.parse(createdAt))) return 'Fecha insuficiente para comprobar cuándo se registró la elección.';
  return createdAt.slice(0, 10) < testStart
    ? 'La elección se registró antes del período informado. Esto no verifica que los resultados fueran desconocidos.'
    : 'La elección se registró el día de inicio o después. No cuenta como una predicción comprobada antes del test.';
}

export function visualDifference(a: Signature, b: Signature) {
  if (a.grid.length !== 288 || b.grid.length !== 288 || [...a.grid, ...b.grid].some(v => !Number.isFinite(v) || v < 0 || v > 255)) throw new Error('Referencia inválida.');
  const cells = Array.from({ length: 96 }, (_, i) => [0, 1, 2].reduce((sum, c) => sum + Math.abs(a.grid[i * 3 + c] - b.grid[i * 3 + c]), 0) / (3 * 255));
  return { cells, difference: cells.reduce((sum, v) => sum + v, 0) / 96 * 100 };
}

export function technicalChecks(v: { width: number; height: number; originalBytes?: number; originalType?: string }) {
  return [
    { title: 'Proporción horizontal 16:9', state: Math.abs(v.width / v.height - 16 / 9) < .015 ? 'ok' : 'review', detail: `${v.width} × ${v.height} px` },
    { title: 'Resolución de origen', state: v.width >= 1920 && v.height >= 1080 ? 'ok' : 'review', detail: 'Objetivo: al menos 1920 × 1080 px' },
    { title: 'Peso del archivo original', state: v.originalBytes === undefined ? 'unknown' : v.originalBytes <= 5 * 1024 * 1024 ? 'ok' : 'review', detail: v.originalBytes === undefined ? 'No disponible en esta copia' : `${(v.originalBytes / 1024 / 1024).toFixed(2)} MB · máximo 5 MB` },
    { title: 'Formato de entrega', state: !v.originalType ? 'unknown' : ['image/jpeg', 'image/png'].includes(v.originalType) ? 'ok' : 'review', detail: v.originalType ? v.originalType.replace('image/', '').toUpperCase() + ' · entregar PNG o JPG' : 'No disponible en esta copia' },
  ];
}
