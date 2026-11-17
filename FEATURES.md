# FEATURES.md — Refactor de `lib/parsers` (multi-banco + PDF posicional)

> Archivo de trabajo temporal. Objetivo: no re-explorar el repo en cada sesión y no
> consumir la ventana de contexto. **Actualizar la sección "Bitácora" al cerrar cada tarea.**
> Cuando el trabajo termine, se elimina o se mueve a `docs/`.

- **Proyecto:** `D:\Proyectos de Programación\financial-control` (Next.js 16 App Router, fullstack)
- **Rama de trabajo:** `testBranch` (actual, árbol limpio al iniciar)
- **Ramas existentes:** `main`, `dev`, `testBranch`
- **Fecha de inicio:** 2026-11-16
- **Estado:** FASES 0, 1, 2, 3 y 4 COMPLETAS · pendientes opcionales: modo sin cabecera y moneda extranjera

---

## 1. Decisiones cerradas con el usuario

| Tema | Decisión |
|---|---|
| Alcance | Refactor completo por fases (core compartido + motor genérico + PDF posicional) |
| Rama | Todo en `testBranch`. Nunca en `dev` ni `main` |
| Commits / push | **Prohibido sin confirmación explícita**. Sin merge a `dev` sin preguntar |
| Detección de bancos | 100% **genérica** por detección de columnas. Sin parsers dedicados por banco; los adaptadores solo aportan *hints* |
| PDF | Extracción **posicional** (X/Y) + regex actuales como fallback |
| Fallback con IA (Gemini) | **No** por ahora |
| Dependencias nuevas | Evitarlas. `date-fns@4.4` está instalado pero se prefiere validación propia |

---

## 2. Reglas del repo que condicionan el trabajo (AGENTS.md)

1. No leer archivos fuera de `financial-control` sin permiso.
2. Tareas grandes: planificar antes de tocar código (cumplido).
3. Sin commits ni ramas automáticas.
4. Nueva feature siempre en `testBranch`; `dev` solo para probar deploy.
5. Si algo no está claro, revisar el código y preguntar.
6. **Verificar la documentación de la versión instalada** antes de usar una API.

---

## 3. Flujo actual (tal como funciona hoy)

```
UploadBulkTransactionForm.tsx (client)
  └─ handleFileChange → extractTransactions(file)          [lib/parsers/file-extractor.ts]
       ├─ getFileSource(fileName)  → solo por extensión (.csv/.xlsx/.xls/.pdf)
       ├─ csv   → parseCsv(file, fileName)                 [lib/parsers/csv-parser.ts]
       ├─ excel → parseExcel(file, fileName)               [lib/parsers/excel-parser.ts]
       └─ pdf   → extractPdfTransactions()
                    └─ pdfjs-dist getTextContent() → items.map(str).join(" ")
                       └─ parseAtlántidaPDF(text, fileName)  [lib/parsers/atlantida-pdf-parser.ts]
  └─ setTransactions(result.transactions) → tabla editable (fecha, desc, tipo, monto, ref, categoría)
       └─ "Suggest categories with AI" → suggestTransactionCategories() [server/transactions/ai-actions.ts]
       └─ submit → formDispatcher → createBulkTransactions() [server/transactions/actions.ts]
            └─ bulkTransactionSchema.safeParse por fila → insert por chunks → revalidatePath
```

### Archivos clave y su rol

| Archivo | Rol |
|---|---|
| `lib/parsers/types.ts` | `ParsedTransaction`, `ExtractResult`, `ParserSource` |
| `lib/parsers/file-extractor.ts` | Orquestador + extracción de texto del PDF con pdfjs |
| `lib/parsers/csv-parser.ts` | Papa 5.7, `header:true`, mapeo de columnas |
| `lib/parsers/excel-parser.ts` | XLSX 0.18.5, `sheet_to_json(header:1)`, detección de fila de cabecera |
| `lib/parsers/atlantida-pdf-parser.ts` | 2 regex globales sobre texto plano |
| `lib/parsers/pdf-worker.d.ts` | Shim de tipos para `pdfjs-dist/build/pdf.worker.mjs` |
| `app/(app)/transactions/_components/UploadBulkTransactionForm.tsx` | UI de carga, tabla editable, toasts, submit |
| `app/(app)/transactions/schema/index.ts` | `bulkTransactionSchema` (validación por fila) |
| `server/transactions/actions.ts` | `createBulkTransactions` (línea ~319) |
| `tests/unit/parsers.spec.ts` | 31 tests L-13…L-31 |

### Restricciones del schema que afectan a los parsers

`app/(app)/transactions/schema/index.ts` → `bulkTransactionSchema`:

- `amount`: string, regex `^\d+(?:[.,]\d{1,2})?$` → **no acepta negativos ni `0.00` con signo; `0.00` sí pasa**.
- `transactionDescription`: `.max(255)` → descripciones de PDF pueden reventar fila por fila.
- `transactionDate`: `YYYY-MM-DD` + refine con `new Date(...)` → **`2026-02-31` se normaliza a 3 de marzo y pasa** (por eso la validación de calendario debe hacerse en el parser).
- `categoryId` es NOT NULL en DB: si falta se usa la categoría por defecto.
- `userId` y `accountId` se resuelven en el servidor (no se confía en el cliente).

---

## 4. Contratos que NO se pueden romper

- Exports públicos usados por tests: `cleanAmount`, `normalizeDate`, `parseCsv`, `parseExcel`, `parseAtlántidaPDF`, `extractTransactions`, `getFileSource`.
- `parseAtlántidaPDF(text, fileName)` mantiene su firma.
- `ExtractResult` se amplía solo de forma **aditiva** (`detection?`, `warnings?`).
- Los 19 tests existentes (`tests/unit/parsers.spec.ts`, L-13…L-31) deben seguir verdes sin editarlos.
- `getFileSource` sigue devolviendo `"csv" | "excel" | "pdf" | "unknown"`.

---

## 5. Hallazgos / bugs confirmados (base del trabajo)

### Dinero (`cleanAmount`, duplicado en 3 archivos)
| Entrada | Hoy | Esperado |
|---|---|---|
| `1.234` | `1.23` | `1234.00` |
| `(1,234.56)` | `1234.56` (+) | negativo |
| `500.00-` | `500.00` (+) | negativo |
| `−500.00` (U+2212) | positivo/0 | negativo |
| `1.234.567` | `0.00` | `1234567.00` |
| basura | `"0"` | `null` (distinguir de cero) |

- Moneda solo soporta `L $ €`; el resto se pierde por descarte de caracteres.
- El tipo se calcula con una **segunda** expresión distinta de `cleanAmount` → signos incoherentes.
- Débito/crédito: si `debit` viene negativo no entra en ninguna rama → transacción `amount: "0.00"` **sin error**.

### Fechas (`normalizeDate`)
- Sin validación de calendario: `31/02/2026` → `2026-02-31`, y el schema lo acepta.
- Solo 3 formatos: `YYYY-MM-DD`, `DD/MM/YYYY`, `YYYY-Mmm-DD`.
- Faltan: `DD-MM-YYYY`, `DD.MM.YYYY`, `YYYY/MM/DD`, `DD/MM/YY`, ISO con hora, `7 Sep 2026`, `Sep 7, 2026`, `07-SEP-26`, meses en inglés.
- Serial de Excel solo en `excel-parser` y limitado a `40000..60000`; CSV no lo soporta.

### CSV / Excel
- CSV asume cabecera en línea 1 → falla con preámbulo, `sep=;`, BOM.
- `file.text()` fuerza UTF-8 → CSV CP1252/Latin-1 dan `DescripciÃ³n` y pierde la columna.
- `findColumnIndex` por `includes` y orden de candidatos → "Monto original"/"Total" pueden ganar; no distingue moneda extranjera.
- Sinónimos faltantes: `debe/haber`, `cargos/abonos`, `retiros/depósitos`, `egresos/ingresos`, `importe`, `withdrawal/deposit`, `paid in/out`.
- Excel: solo primera hoja; cabecera debe ser exactamente `fecha`/`date`/`transactiondate`; `rowNum = i + 2` desfasado (+5 con preámbulo de Atlántida).
- `result.errors` de Papa se descarta; el callback `error` es casi inalcanzable con string.
- `if (!description && !bankReference)` es código muerto (`|| "No description"`).
- No se usa la columna `Saldo` → sin validación cruzada.

### PDF
- `items.map(str).join(" ")` destruye líneas/columnas antes de aplicar regex.
- `FORMATO_2_REGEX` sin ancla de fin de línea → descripción con número final puede desalinear débito/crédito.
- `FORMATO_1_REGEX` exige literal `L `; falla con `L.`, `HNL`, `US$`.
- Sin continuidad entre páginas, sin filtrar pies repetidos, sin cuadre de saldo, sin PDFs cifrados/escaneados.

### Transversal
- Sin metadatos de detección (`parser used: pdf` es todo lo que ve el usuario).
- Sin fallback: si no es Atlántida, falla.
- Sin dedupe al re-subir (tempId usa `Date.now()`/`random`).
- `xlsx` importado estáticamente (bundle pesado).

---

## 6. Arquitectura objetivo

```
lib/parsers/
  core/
    money.ts      parseAmount(raw) -> { value: number|null, negative, currency }
    dates.ts      parseDate(raw, { dayFirst }) -> { iso, confidence } + resolveDayFirst()
    text.ts       decodeFileBytes() UTF-8/CP1252/UTF-16 + normalizeText() (NFKC, NBSP, sep=)
    table.ts      Matrix=string[][]; detectHeader, mapColumns, extractRows, reconcileBalances
    detection.ts  DetectionInfo, ParseWarning, scoring de formato/banco
  pdf/
    layout.ts     TextItem[] -> filas(Y) y celdas(X)
  adapters/
    atlantida.ts      solo hints (firma, orden de fecha, moneda, líneas resumen)
    generic-table.ts  CSV/XLSX sin cabecera conocida
    generic-pdf.ts    cabecera posicional + fallback regex anclado
  file-extractor.ts orquestador: sniff por bytes -> adapters por score -> fallback chain
```

Principios:
1. **Toda fuente se normaliza a `Matrix`** → CSV, XLSX y PDF comparten mapeo/validación.
2. **Mapeo auto-validado**: se prueban hipótesis (fecha A/B, monto vs débito/crédito, swap) y gana la de mayor tasa de parseo + cuadre de saldo.
3. **Cuadre de saldo** `anterior + crédito − débito ≈ saldo` como validador de columnas.
4. **PDF posicional** con `transform[4]` (X), `transform[5]` (Y), `height` y `hasEOL`; regex solo como respaldo.
5. `ExtractResult.detection` expone formato, banco, moneda, confianza, mapping y warnings a la UI.

---

## 7. Fases y checklist

### Fase 0 · Core compartido (sin cambiar comportamiento)
- [x] `core/money.ts` con `parseAmount`
- [x] `core/dates.ts` con `parseDate` + `resolveDayFirst`
- [x] `core/text.ts` con `decodeBytes` + `normalizeText` + `stripSepLine` + `looksLikeText`
- [x] `core/table.ts` con `Matrix` + detección/mapeo/parseo/reconciliación
- [x] `core/detection.ts` (creado en Fase 2: sniffing por bytes + firmas de banco/moneda)
- [x] Ampliar `lib/parsers/types.ts` (`warnings`, `detection`, `rawRow`)
- [x] Los 3 parsers delegan en el core conservando exports y firma
- [x] `cleanAmount` / `normalizeDate` siguen funcionando (wrappers)
- [x] `npx vitest run tests/unit` verde (104 tests al cierre de Fase 0)

### Fase 1 · Corrección de bugs
- [x] Signos contables (`()`, menos final, unicode), `1.234`, multi-separador, monedas
- [x] `parseAmount` devuelve `null` si no hay monto
- [x] Validación de calendario real + formatos nuevos + ambigüedad por archivo
- [x] Filas con monto 0 / débito negativo → error explícito
- [x] Tipo derivado del mismo parseo de monto
- [x] `rowNum` absoluto en CSV y Excel (todas las hojas)
- [x] Descripción truncada a 255 con warning
- [x] `result.errors` de Papa → warnings
- [x] Eliminar código muerto (`description`/`bankReference`)

### Fase 2 · Motor genérico CSV/XLSX
- [x] Sniffing por bytes en `file-extractor` (`PK`, `%PDF`, `OLE`) + extensión, con precedencia contenido fuerte > extensión > texto
- [x] CSV: `arrayBuffer` → decode → quitar `sep=`/BOM → Papa `header:false` → `Matrix`
- [x] Excel: todas las hojas, elegir por score, `defval: ""`, `blankrows: true`
- [x] Motor de tabla: scoring de cabecera, sinónimos ES/EN, modos (firmado / débito-crédito / tipo) — implementado en `core/table.ts`
- [x] Mapeo auto-validado (validación de columna de fecha contra los datos) + cuadre de saldo en ambos sentidos
- [x] Hints de banco/moneda en `core/detection.ts` (sin archivo `adapters/atlantida.ts`: la abstracción no hacía falta)
- [x] `detection` poblado en `ExtractResult` para CSV, Excel y PDF (banco, moneda, delimitador, encoding, hoja, columnas)
- [ ] Modo sin cabecera (inferencia de columnas por patrón de datos)
- [x] Detección de columnas combinadas `Débito/Crédito` (test T-41)
- [ ] Moneda extranjera por columna (`Monto USD` vs `Monto HNL`)

### Fase 3 · PDF posicional
- [x] `pdf/layout.ts` (Y clustering, X sorting, celdas por huecos, estimación de ancho)
- [x] Detección de cabecera y asignación por anclaje X (textos por `x`, números por `xEnd`)
- [x] Multi-página, cabeceras repetidas, continuación de descripción, líneas resumen descartadas
- [x] `pdf/generic-pdf.ts` conectado en `file-extractor.ts` con fallback regex (`atlantida-pdf-parser.ts`)
- [x] `detection` de PDF (banco, moneda, columnas, `balanceChecked`)
- [ ] PDF sin texto / cifrado → mensaje accionable (OCR fuera de alcance)
- [ ] Cuadre de saldo en PDF cuando la fila de cabecera tiene `Saldo` (ya heredado de `parseTable`; falta test con PDF real)

### Fase 4 · Integración UI
- [x] Chip de detección + panel de warnings en `UploadBulkTransactionForm.tsx`
- [x] Texto del dropzone sin "Banco Atlántida" (genérico, cualquier banco)
- [x] Prefill de moneda detectada (respetando `currencyTouched`, solo HNL/USD/EUR)
- [x] `xlsx` en import dinámico (dentro de `parseExcel`)
- [x] Aviso de posible duplicado (`bankReference` + fecha + monto + tipo)

### Tests
- [x] `tests/unit/parsers/money.spec.ts` (58)
- [x] `tests/unit/parsers/dates.spec.ts` (57)
- [x] `tests/unit/parsers/table.spec.ts` (40)
- [x] `tests/unit/parsers/text.spec.ts` (25)
- [x] `tests/unit/parsers/detection.spec.ts` (18)
- [x] `tests/unit/parsers/integration.spec.ts` (18)
- [x] `tests/unit/parsers/pdf.spec.ts` (18, `TextItem` a mano)
- [ ] `tests/fixtures/parsers/`: preámbulo, `;`+coma decimal, CP1252, `sep=`, BOM, UTF-16
- [x] L-13…L-31 sin modificar y verdes

---

## 8. APIs verificadas en las versiones instaladas

`package.json`: `papaparse ^5.7.0`, `xlsx ^0.18.5`, `pdfjs-dist ^5.6.205`, `next 16.1.7`, `react 19.2.4`, `zod ^4.4.3`, `vitest ^4.1.11`.

- **pdfjs-dist 5.6.205**: `TextItem` incluye `str`, `dir`, `transform: any[]`, `width`, `height`, `fontName`, `hasEOL` (`node_modules/pdfjs-dist/types/src/display/api.d.ts` líneas ~338-357). `getTextContent()` permite reconstrucción posicional.
- `GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs")).default` (ya usado en `file-extractor.ts`).
- **Papa 5.7**: `header`, `transformHeader`, `skipEmptyLines`, `delimiter`, `delimitersToGuess`, `beforeFirstChunk`; `result.errors` disponible y hoy ignorado.
- **XLSX 0.18.5**: `XLSX.read(buffer, { type: "array" })`, `utils.sheet_to_json(ws, { header: 1, defval: "", raw: true })`.

---

## 9. Comandos útiles

```bash
npm run test -- parsers        # tests unitarios de parsers
npm run test                   # vitest
npm run typecheck
npm run lint
npm run dev
```

---

## 10. Bitácora (append-only)

| Fecha | Fase | Nota |
|---|---|---|
| 2026-11-16 | — | Investigación completa de `lib/parsers` + flujo de carga + schema. Plan aprobado. Rama `testBranch` limpia. Sin cambios de código. |
| 2026-11-16 | 0 | Creados `core/money.ts`, `core/dates.ts`, `core/text.ts` (subagente, 25 tests), `core/table.ts`. `types.ts` extendido (`warnings`, `detection`, `rawRow`). CSV/Excel/Atlántida delegan en el core. `tsc --noEmit` limpio. 104 tests unitarios verdes (19 existentes + 25 text + 60 de otros módulos). |
| 2026-11-16 | 1 | Bugs cubiertos: signos contables y unicode, `1.234`, monedas, `null` vs cero, calendario real, formatos de fecha ampliados, día/mes por archivo, monto 0 explícito, tipo desde el mismo parseo, fila absoluta, truncado 255, errores de Papa como warnings. |
| 2026-11-16 | 2 | CSV lee `arrayBuffer` + encoding, `sep=`, Papa `header:false`; Excel recorre todas las hojas (`blankrows: true`); mapeo por scoring con validación contra datos; cuadre de saldo en ambos sentidos; `detection` en CSV/Excel. Sniffing por bytes en `core/detection.ts` (PDF/ZIP/OLE > extensión > texto; imágenes y comprimidos rechazados) + `detectBank` / `detectCurrencyFromText`. |
| 2026-11-16 | 3 | `pdf/layout.ts` (filas por Y, celdas por X con estimación de ancho) y `pdf/generic-pdf.ts` (cabecera por scoring, asignación por anclaje, continuación de descripción, cabeceras repetidas, multi-página). Conectados en `file-extractor.ts` antes del fallback regex. `transform` exige números reales (`Number(null) === 0` era un falso positivo). Subagente: 18 tests de PDF con `TextItem` sintéticos. |
| 2026-11-16 | 4 | UI: chip de detección (formato/banco/moneda/hoja/delimitador/confianza/saldo verificado), panel de warnings, texto de dropzone genérico, prefill de moneda detectada (`currencyTouched`, solo HNL/USD/EUR), `xlsx` en import dinámico y aviso de duplicados por referencia+fecha+monto+tipo. Filas de resumen (`Saldo anterior`, `Total`, `Resumen`) se omiten sin error en `parseTable`. **264 tests verdes**, `tsc` y `eslint` limpios. |

### 10.1 Archivos nuevos creados

| Archivo | Contenido |
|---|---|
| `lib/parsers/core/money.ts` | `parseAmount`, `formatAmount`, `amountToPositiveString`, `looksLikeAmount`, `CurrencyCode` |
| `lib/parsers/core/dates.ts` | `parseDate`, `resolveDayFirst`, `isValidIsoDate` |
| `lib/parsers/core/text.ts` | `decodeBytes`, `normalizeText`, `stripSepLine`, `looksLikeText` (UTF-8/UTF-16/CP1252 con fallback sin `TextDecoder`) |
| `lib/parsers/core/table.ts` | `Matrix`, `detectHeader`, `mapColumns`, `parseTable`, `reconcileBalances`, `resolveTypeFromLabel`, `toMatrix`, `normalizeCell`, `mappingToColumnIndexes` |
| `lib/parsers/core/detection.ts` | `sniffFormatFromBytes`, `resolveFileFormat`, `detectBank`, `detectCurrencyFromText` |
| `lib/parsers/pdf/layout.ts` | `buildPdfRows`, `pdfRowsToText`, tipos `PdfTextItem` / `PdfCell` / `PdfRow` |
| `lib/parsers/pdf/generic-pdf.ts` | `parsePdfRows`, `parsePdfPages` |
| `tests/unit/parsers/text.spec.ts` | 25 tests de decodificación/normalización |
| `tests/unit/parsers/money.spec.ts` | 58 tests de montos y monedas |
| `tests/unit/parsers/dates.spec.ts` | 57 tests de fechas |
| `tests/unit/parsers/table.spec.ts` | 38 tests del motor de tabla |
| `tests/unit/parsers/integration.spec.ts` | 18 tests de integración CSV/Excel |
| `tests/unit/parsers/detection.spec.ts` | 18 tests de sniffing y firmas de banco/moneda |
| `tests/unit/parsers/pdf.spec.ts` | 18 tests de layout y parseo posicional |

### 10.2 Decisiones de implementación tomadas durante Fase 0

- `parseAmount` devuelve `value: number | null` con signo; los parsers usan `amountToPositiveString` para guardar siempre positivo.
- `1.234` se interpreta como miles (los bancos no usan 3 decimales); `0.500` sí es decimal por el caso especial de parte entera `0`.
- `parseDate` valida calendario con `Date.UTC` + round-trip de componentes.
- La fila de cabecera se valida contra los datos: si hay ≥2 valores y ninguno parsea como fecha, la fila se descarta.
- La numeración de fila es absoluta (`firstRowNumber + índice`), lo que corrige el desfase de Excel con preámbulo.
- El saldo se reconcilia en sentido ascendente y descendente; se reporta el sentido con menos diferencias.
- `parseTable` no inventa tipos: si no hay signo ni columna `type`, un monto positivo es `income` (comportamiento previo conservado).
- Los tests de `tests/unit/**` corren en entorno **node** con `tests/setup/db.ts`, que exige `.env.test.local` (ya existe).

### 10.3 Decisiones de las fases 1–3

- `parseAmount` elimina los símbolos/códigos de moneda antes de analizar separadores (el punto de `L. 500` ya no se lee como decimal) y nunca devuelve `-0`.
- Los timestamps epoch exigen no tener ceros a la izquierda (`^[1-9]\d{9}$` / `^[1-9]\d{12}$`) para no confundir números de referencia con fechas.
- Se agregaron sinónimos `withdrawal` / `deposit` al diccionario de cabeceras (faltaban; los detectó un test).
- Precedencia del sniffing: firmas binarias fuertes (PDF/ZIP/OLE) > lista de extensiones no soportadas (imágenes, comprimidos, ofimática, json/xml) > extensión conocida > contenido de texto.
- `skipEmptyLines: false` en Papa para que el índice de la matriz coincida con la línea real del archivo (numeración absoluta).
- PDF: se usa el layout posicional solo si produce al menos una transacción; si no, se cae al parser regex de Atlántida. Así un PDF con formato desconocido no empeora respecto al comportamiento anterior.
- En PDF, las celdas numéricas se anclan por `xEnd` y las de texto por `x`, y las filas sin fecha se descartan silenciosamente antes de llegar a `parseTable`.
- `parseTable` descarta sin error las filas cuyo primer texto empieza por `Saldo`, `Total`/`Totales`, `Subtotal`, `Gran total` o `Resumen`; una fecha ilegible que no matchea esos prefijos sigue reportándose (`Row N: invalid date`).
- La UI solo ofrece HNL/USD/EUR, así que el prefill de moneda detectada se limita a esas tres; el resto se muestra en el chip pero no cambia el select.

---

## 11. Pendientes / decisiones abiertas

- **Modo sin cabecera** (inferencia de columnas por patrón de datos): no implementado. Riesgo de falsos positivos al convertir un archivo cualquiera en transacciones; conviene decidir con el usuario si se quiere y con qué límites (solo si ≥N filas con fecha y monto consistentes).
- **Moneda extranjera por columna** (`Monto USD` vs `Monto HNL` en el mismo archivo): hoy se elige una sola columna de monto y las demás se ignoran; `detection.currency` reporta la dominante.
- **Columnas combinadas `Débito/Crédito`**: soportadas en `buildMapping` (una columna que puntúa para ambos roles se trata como monto firmado); falta un test dedicado.
- ¿Fixtures reales de estados de cuenta (otro banco) o solo sintéticos? (default: sintéticos)
- ¿Añadir dedupe persistente contra DB en una fase posterior? (fuera de alcance por ahora; la UI solo avisa duplicados dentro del mismo archivo)
- **Commit / merge:** todo el trabajo está sin commit en `testBranch`. No se hace commit, push ni merge a `dev` sin confirmación explícita.
