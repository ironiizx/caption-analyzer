# Thumbnail Insights — Studio 03 / Discover Lab

Discover Lab agrega una vista previa independiente de Fortnite para evaluar diseños en contexto antes de publicarlos. El estudio de análisis, comparación e historial se conserva en `/`; el simulador está en `/discover`.

## Novedades de Studio 03

- Escenarios Discover horizontal, Top 10 portrait, ficha de isla y A-Spot ajustable 4:1 / 5:1. Son plantillas aproximadas, no una réplica universal del cliente de Fortnite.
- Paquetes A/B independientes con horizontal, portrait, logo transparente y A-Spot; un mismo escenario, posición, referencias y encuadre para ambas variantes.
- Modo «Tu captura»: cargar una pantalla propia de Fortnite y dibujar el área a sustituir. Ajuste numérico, flechas, radios de esquina y selección del formato. Se mantiene el resto de la captura.
- Posición de la tarjeta, imágenes vecinas propias, cover/contain, punto de enfoque, guías aproximadas y logo opcional. Pantalla completa y vista a 100 %.
- Copias de trabajo de hasta 2560 px, archivos originales hasta 12 MB y 64 megapíxeles; PNG con alfa para logos. No sustituye los originales de entrega.
- Borrador local en IndexedDB separado del estudio, copia JSON autocontenida e importación validada. Límite conjunto de datos de imagen: 32 MB.
- Exportación PNG sin guías ni selección y presentación HTML A/B con imágenes embebidas; imprimible como PDF. Escenarios construidos con el mismo renderer de la vista previa.
- Uso local sin solicitudes a OpenAI. No calcula CTR, atención real ni probabilidad de aprobación por Epic. Los ejemplos geométricos son propios y ficticios; no se distribuyen imágenes de clientes ni capturas de Fortnite.

## Novedades de Studio 02

- Comparación lado a lado, deslizador con teclado (misma proporción), alternancia y vista real a 160 px. Las imágenes de distinta proporción conservan su encuadre.
- Métricas secundarias en desplegables; resultados y acciones principales primero. Diseño adaptable a móvil y controles con nombre accesible.
- Borradores automáticos en IndexedDB, separados del guardado explícito en la cuenta. Recuperación al recargar, listado local y copias JSON v1/v2 con imágenes y registros.
- Registro fechado de elecciones manuales o recomendaciones de IA, resultados A/B vinculados y chequeos de Epic informados por el usuario. Las imágenes referenciadas no se eliminan para preservar el historial.
- Distingue elecciones registradas antes del período del test de las registradas durante o después. No calcula una tasa de acierto predictivo con estos registros ni verifica que los resultados fueran desconocidos.
- Chequeo técnico horizontal sobre dimensiones, peso y MIME del archivo original. Si una copia antigua no conserva los metadatos, muestra «sin dato».
- Comparación local de color por zonas 12 × 8 entre referencias aportadas. No reconoce semántica, no busca en todo Fortnite y no reproduce el detector de similitud de Epic.
- `/api/compare`: dos imágenes, preferencia visual A/B o abstención, evidencia específica y mejoras. Salida estructurada validada, caché por par ordenado/contexto/modelo, límite compartido con análisis y sin reintentos automáticos.
- Las imágenes privadas responden `Cache-Control: private, no-store` para evitar recuperar desde la caché del navegador una imagen de una sesión anterior.

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

El Site continúa privado. El usuario configuró la misma `OPENAI_API_KEY` como secreto del servidor y confirmó que la comparación con IA funciona en producción. La clave no está en el repositorio. No se realizaron llamadas pagas ni se generaron imágenes durante esta entrega.

Discover Lab funciona sin API y guarda sus escenarios únicamente en el navegador; descargar la copia permite trasladarlos a otro equipo. La sincronización entre dispositivos, un modelo entrenado con experimentos, pruebas con participantes y cobros quedan para entregas posteriores.

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

El límite de 20 es un límite de solicitudes, no un tope de facturación monetario. Las imágenes se transmiten a OpenAI únicamente al pedir mejoras o comparar con IA. Cambiar el contexto oculta el análisis anterior hasta obtener un resultado correspondiente al nuevo contexto. `store:false` no equivale a afirmar retención cero en todos los sistemas del proveedor.

### Datos

`.openai/hosting.json` declara `DB` (D1), `BUCKET` (R2) y la identidad de este Site. No contiene claves. D1 almacena metadatos/experimentos/resultados. R2 almacena imágenes bajo prefijos de identidad; cada endpoint requiere la identidad y valida propiedad. Los nombres de archivo de R2 son hashes del contenido calculados en el servidor.

Migraciones: editar `db/schema.ts`, ejecutar `npm run db:generate`, revisar el SQL generado. Tras un build, aplicar solo las pendientes al preview:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_eager_ultragirl.sql
```

Sites aplica las migraciones de producción al publicar. No se modifica el esquema durante solicitudes HTTP.

### Verificación

`npm test`: 25 pruebas sobre la regresión de saturación, grises, alfa, contraste, bordes, CTR, intervalos extremos, CSV, comparación estructurada, abstención, firmas espaciales, metadatos de origen y orden temporal de decisiones; además, geometría de selección/encuadre, aislamiento A/B, importación y límites del simulador.

`npm run test:integration -- http://localhost:PORT`: pruebas HTTP con usuarios ficticios, solo sobre una instancia local accesible, con D1/R2 configurados y sin clave de API. El script verifica autenticación, propiedad, guardado, recuperación, MIME y origen. Nunca debe ejecutarse contra producción.

`npx tsc --noEmit` y build de producción. QA manual en navegador para carga, revisión, comparación, conceptos y experimentos. Studio 02 verificó además recarga del borrador, exportación/importación con relaciones entre registros y vista móvil a 390 px sin desborde horizontal.

`tests/browser-integration.html`: arnés alternativo para cuando el ejecutor no alcanza el servidor local. Copiarlo temporalmente a `public/qa-integration.html`, abrirlo solo en el preview local y ejecutar sus controles con identidades ficticias. Se completaron 14 verificaciones: autenticación, clave ausente, carga, guardado de registros, recuperación, aislamiento entre usuarios, MIME y caché privada. Borrar la copia pública antes del build; nunca publicar el arnés. No realiza llamadas a OpenAI. La prueba funcional de IA en producción fue realizada y confirmada por el usuario; estas pruebas automatizadas no consumen API.

## Decisiones y límites metodológicos

Las métricas usan una muestra de hasta 320 px y transparencia compuesta sobre blanco. El contraste no es un cálculo WCAG. La paleta selecciona cinco celdas frecuentes de un espacio RGB de ocho niveles por canal; no son cinco categorías perceptuales independientes.

Los CTR son calculados con conteos ingresados o importados por el usuario. No se presentan como auditados por Epic. Los intervalos Wilson asumen independencia binomial; la exposición repetida, los cambios de audiencia y el diseño de cada experimento pueden invalidar ese supuesto. Una diferencia entre períodos no demuestra causalidad.

La guía local recomienda comprobaciones; no reconoce objetos. La guía de conceptos aplica estructuras explícitas; no genera imágenes. El análisis IA es una interpretación revisable que debe contrastarse con decisiones de diseño y, cuando sea posible, pruebas con personas.

## Fuentes técnicas consultadas

- [Responses y Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Modelo configurable GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)

## Próxima entrega

1. Validar el simulador con los paquetes reales de Roni y capturas de las plataformas que utiliza.
2. Incorporar pruebas con participantes y resultados por posición/escenario, diferenciados del CTR real de Epic.
3. Registrar decisiones previas a experimentos A/B y sus resultados para evaluar un modelo propio sin fuga de datos entre versiones de una misma isla.
4. Generación visual y costos solo después de definir un presupuesto explícito.

Referencias de formato: [Epic: Making Thumbnails and Videos](https://dev.epicgames.com/documentation/fortnite/making-thumbnails-and-videos-in-fortnite-creative). La interfaz real puede variar por versión, plataforma y personalización.
