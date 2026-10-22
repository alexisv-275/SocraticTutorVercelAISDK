# ThinkAgora — PoC socrática con Vercel AI SDK

Consola Node.js + TypeScript para comprobar el flujo pedagógico del [contrato v0.3](Contrato-pedagogico-y-pruebas.md), siguiendo los hitos de la [guía](Guia-implementacion.md). Diagnóstico y estrategia son deterministas; solo el Tutor usa Claude. No requiere despliegue en Vercel.

## Preparación

Requiere Node.js 22 o superior; verificado con 24.19.0. Instala las versiones fijadas:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
```

En Windows se usa `npm.cmd` para evitar la restricción de ejecución de `npm.ps1`. En otros shells puedes usar `npm`.

## Probar sin API

```powershell
npm.cmd run scenarios -- --mock --include-start
npm.cmd run dev -- --mock
```

`--mock` es explícito: no carga credenciales ni realiza llamadas a Claude. Las respuestas son ejemplos estáticos para comprobar el flujo. No sirven para evaluar calidad pedagógica, variación de preguntas, latencia del modelo ni eficiencia comparativa.

El runner carga E1–E5 desde copias limpias. `--include-start` agrega el chequeo RP01, registrado aparte. Los JSON se guardan en `outputs/`, con un identificador único por ejecución.

## Activar Claude

```powershell
Copy-Item .env.example .env
```

El modelo elegido es `claude-sonnet-4-6` y ya está configurado. Completa únicamente tu clave en `.env`:

```dotenv
ANTHROPIC_API_KEY=tu_clave
ANTHROPIC_MODEL=claude-sonnet-4-6
TEMPERATURE=0
MAX_OUTPUT_TOKENS=1200
```

El usuario eligió `claude-sonnet-4-6`; utiliza exactamente el mismo modelo en ambas PoC. No hay selección automática ni modelo alternativo. `.env` está ignorado por Git y la clave nunca se incluye en los reportes. Las variables del proceso tienen precedencia sobre `.env`.

Después de incorporar el material académico común:

```powershell
npm.cmd run scenarios
npm.cmd run scenarios -- --include-start
npm.cmd run dev
```

El primer comando ejecuta cinco intervenciones medidas, normalmente una llamada por escenario. RP01 agrega una llamada de inicio separada. La demo genera una intervención al iniciar, elegir tema, responder o pedir pista. Una entrada inválida no llama al modelo.

No se han ejecutado pruebas reales con Claude durante la implementación. La generación real de H3 y el cumplimiento pedagógico siguen pendientes.

## Recorrido en consola

1. Elige uno de los tres temas del material.
2. Responde `A`, `B` o `C` (también `1`, `2`, `3`).
3. Usa `4` para pedir pista o `5` para elegir otro tema.
4. Escribe `salir` para terminar y guardar el registro.

Un acierto solicita transferencia; el primer error ofrece pista; el segundo error consecutivo explica y simplifica. Una transferencia fallida vuelve a `IN_PROGRESS`. `VERIFIED` requiere un acierto anterior del concepto y transferencia correcta. Cambiar de tema reinicia el estado activo y conserva el historial. Un error de generación conserva la pregunta y el progreso para reintentar.

## Arquitectura y archivos

| Ruta | Responsabilidad |
|---|---|
| `src/config/` | Validación de `.env` y proveedor Anthropic directo |
| `src/domain/` | Tipos Zod, reglas literales, validación estructural y respuesta pública |
| `src/academic/scrum.md` | Corpus fijo compartido, actualmente provisional |
| `src/academic/context.ts` | Catálogo de temas/conceptos, procedencia y SHA-256 del material |
| `src/services/diagnostic.ts` | Compara la elección con la clave; no infiere intenciones |
| `src/services/strategy.ts` | Selecciona la estrategia según RP03–RP07 |
| `src/services/prompt.ts` | Reglas del Tutor e información variable acotada |
| `src/services/tutor.ts` | Generación estructurada y único reintento explícito |
| `src/services/orchestrator.ts` | Validación de acciones y único dueño del commit de estado |
| `src/infrastructure/` | Almacén en memoria y métricas por turno/intento |
| `src/fixtures/` | Q01–Q03, S0, E1–E5 y Tutor simulado |
| `src/cli/` | Demo, runner y exportación JSON |
| `src/tests/` | Pruebas sin red, incluido SDK/proveedor con transporte simulado |

El contrato original se carga para reutilizar literalmente RP01–RP10 y la rúbrica. Se debe conservar ese Markdown en la raíz del proyecto. Los dos documentos de planificación no se modifican.

## Material académico pendiente

El usuario proporcionará un Markdown corto. Por ahora `src/academic/scrum.md` conserva literalmente el contexto provisional del contrato. Solo nombra Sprint Planning y Daily Scrum; no permite enseñar su propósito ni detalles. El tercer tema, gestión del Product Backlog, procede del mismo texto.

Al recibir la fuente, hay que sustituir el material, revisar el catálogo y sus conceptos en `context.ts` y `contracts.ts`, y actualizar la procedencia/estado de `CORPUS`. Debe respaldar Q01–Q03 y los temas roles/eventos. Copiar exactamente el mismo archivo a la otra PoC: la huella SHA-256 permite detectar diferencias. No comparar resultados con corpus distintos ni presentar el provisional como validado.

## Métricas y evaluación

Cada turno registra `runId`, `turnId`, arquitectura, modo, escenario, sesión, modelo, diagnóstico resumido, estrategia, estado técnico, tiempos de inicio/fin, latencia, llamadas y tokens. Cada intento registra rol `Tutor`, uso, duración, modelo, estado y código de error. La configuración pública y la huella del corpus se guardan por ejecución.

- Se usa `totalUsage` una sola vez; nunca se suma también `usage`.
- El total comparable es entrada + salida; el total del proveedor se conserva aparte por intento.
- Uso desconocido: `null`. Si un intento no informa tokens, el agregado correspondiente también es `null`.
- Cero llamadas (mock o aclaración): cero tokens efectivamente consumidos. Los tiempos del mock no representan latencia de Claude.
- La latencia es tiempo de pared del turno completo, incluyendo reintento; no suma duraciones internas.
- `maxRetries: 0` desactiva reintentos ocultos del SDK. Hay como máximo un reintento explícito ante fallos transitorios o salida inválida, con 500 ms de espera. Cada intento tiene timeout de 45 segundos.
- Un 401 no se reintenta. Los fallos se conservan en el reporte y el runner termina con código 1 si alguno falla.

En el JSON de escenarios, `publicResponse` es lo visible. `privateEvaluation` contiene estados y claves para el evaluador: **no mostrar ese reporte completo al estudiante**. El JSON de la demo guarda respuestas públicas y métricas, sin claves de preguntas.

La rúbrica se copia literalmente en cada caso. Completa manualmente `passedChecks`, `applicableChecks`, `criticalFailures` y `notes`; inicialmente son `null`. Hay tres chequeos por escenario. Solo después de revisar cada punto calcula `(passedChecks / applicableChecks) × 100`. Registra aparte revelaciones prematuras, declaraciones de dominio indebidas, contenido no respaldado, pérdida de historial o bucles. `SUCCEEDED` significa éxito técnico, no aprobación pedagógica.

Zod valida estructura, conceptos, tipos, dificultad y opciones; no garantiza corrección académica, ausencia de revelaciones en prosa, transferencia real ni utilidad de las pistas. Esa revisión requiere una persona. No hay evaluador LLM.

## Estado y límites

Ver [IMPLEMENTACION.md](IMPLEMENTACION.md) para los cierres de hitos y resultados. Se mantienen estado en memoria, generación sin streaming y alcance exploratorio. RP10/checkpoint no está activado; se puede terminar en cualquier momento con `salir`. No hay RAG, frontend, REST, autenticación ni base de datos.

Pendientes para validar con Claude: corpus común del usuario, clave y evaluación manual E1–E5. El modelo ya está fijado en `claude-sonnet-4-6`. Los resultados locales no permiten concluir que AI SDK sea superior a LangChain/LangGraph.
