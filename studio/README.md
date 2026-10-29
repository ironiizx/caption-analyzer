# Thumbnail Insights — Creator Lab

Primera entrega de la evolución del analizador de miniaturas UEFN de Roni. Combina herramientas visuales gratuitas, comparación, documentación de experimentos y un endpoint de análisis con IA.

## Funciones incluidas

- Carga por archivo, arrastre, pegado o URL HTTPS que permita CORS.
- Brillo sRGB ponderado, contraste global, saturación HSL por píxel, bordes Sobel y paleta cuantizada. Las métricas se calculan en el navegador y no representan calidad ni CTR previsto.
- Vista pequeña a 320/160 px, escala de grises, tercios y comparación de hasta seis variantes.
- Proyectos privados con identidad de ChatGPT, datos en D1 e imágenes de trabajo en R2. Copias de trabajo JPEG de hasta 1280 px; conservar originales para entregas finales.
- Exportación JSON con imágenes y restauración del proyecto. La importación recalcula métricas y conserva el análisis editorial válido; los vínculos A/B se reasignan a las imágenes importadas.
- Experimentos con hipótesis, fuente declarada, fechas, clics e impresiones. CTR, diferencia en puntos porcentuales, cambio relativo e intervalos Wilson por variante. CSV propio de dos filas A/B; sin integración automática con Epic ni declaración de ganador.
- Tres guías de composición deterministas, identificadas como herramientas sin IA.
- Endpoint OpenAI con salida estructurada, errores controlados, caché por imagen/contexto/modelo y máximo de 20 intentos por usuario por día UTC. Incluye intentos fallidos para evitar reintentos de gasto incierto. No hay reintentos automáticos.

## Estado real

Las herramientas de navegador funcionan sin API. El sitio se publica privado. El análisis y caption con IA requieren `OPENAI_API_KEY` como secreto del servidor: **la clave existente del usuario no está en este checkout y no se realizaron llamadas pagas durante el desarrollo**. La configuración se informa como pendiente en la interfaz; no se simula una respuesta ni se inventan captions.

Portraits, logos, generación visual de conceptos, cobros, créditos comerciales, reportes de Epic y evaluación con participantes quedan para entregas posteriores.

## Desarrollo

Node 22.13+; dependencias fijadas por `pnpm-lock.yaml`. La aplicación usa React y rutas compatibles con Next sobre Vinext/Cloudflare Workers. Se conserva la integración `sites()` del starter.

```sh
npm run install:ci
npm run dev
npm run test
npm run build
```

En el entorno administrado de Sites, usar los helpers de la skill Sites para instalación, preview, build y publicación. No iniciar otro servidor de preview por fuera de `sites-preview`.

### Variables

`OPENAI_API_KEY`: secreto del servidor, nunca `NEXT_PUBLIC_*`. Reutilizar la clave ya autorizada mediante un flujo seguro. No pegarla en GitHub ni en un mensaje.

`OPENAI_MODEL`: opcional; predeterminado `gpt-6-luna`. La disponibilidad efectiva de la cuenta se comprueba al activar la integración. La UI informa configuración, no conectividad comprobada.

El límite de 20 es un límite de solicitudes, no un tope de facturación monetario. La imagen se transmite a OpenAI únicamente al pulsar Analizar con IA. `store:false` no equivale a afirmar retención cero en todos los sistemas del proveedor.

### Datos

`.openai/hosting.json` declara `DB` (D1), `BUCKET` (R2) y la identidad de este Site. No contiene claves. D1 almacena metadatos/experimentos/resultados. R2 almacena imágenes bajo prefijos de identidad; cada endpoint requiere la identidad y valida propiedad. Los nombres de archivo de R2 son hashes del contenido calculados en el servidor.

Migraciones: editar `db/schema.ts`, ejecutar `npm run db:generate`, revisar el SQL generado. Tras un build, aplicar solo las pendientes al preview:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_eager_ultragirl.sql
```

Sites aplica las migraciones de producción al publicar. No se modifica el esquema durante solicitudes HTTP.

### Verificación

`npm test`: 12 pruebas sobre la regresión de saturación, grises, alfa, contraste, bordes, CTR, intervalos extremos, CSV e interpretación de respuestas estructuradas.

`npm run test:integration -- http://localhost:PORT`: pruebas HTTP con usuarios ficticios, solo sobre una instancia local accesible, con D1/R2 configurados y sin clave de API. El script verifica autenticación, propiedad, guardado, recuperación, MIME y origen. Nunca debe ejecutarse contra producción.

`npx tsc --noEmit` y build de producción. QA manual en navegador para carga, revisión, comparación, conceptos y experimentos.

## Decisiones y límites metodológicos

Las métricas usan una muestra de hasta 320 px y transparencia compuesta sobre blanco. El contraste no es un cálculo WCAG. La paleta selecciona cinco celdas frecuentes de un espacio RGB de ocho niveles por canal; no son cinco categorías perceptuales independientes.

Los CTR son calculados con conteos ingresados o importados por el usuario. No se presentan como auditados por Epic. Los intervalos Wilson asumen independencia binomial; la exposición repetida, los cambios de audiencia y el diseño de cada experimento pueden invalidar ese supuesto. Una diferencia entre períodos no demuestra causalidad.

La guía local recomienda comprobaciones; no reconoce objetos. La guía de conceptos aplica estructuras explícitas; no genera imágenes. El análisis IA es una interpretación revisable que debe contrastarse con decisiones de diseño y, cuando sea posible, pruebas con personas.

## Fuentes técnicas consultadas

- [Responses y Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Modelo configurable GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)

## Próxima entrega

1. Configurar la misma clave del usuario como secreto del Site y probar un análisis visual real con un presupuesto acotado.
2. Evaluar recomendaciones con miniaturas y criterios autorizados de Roni.
3. Generación de portraits/logos, correcciones y registro de costos.
4. Importación de reportes reales, pruebas con participantes y documentación para la tesis.
