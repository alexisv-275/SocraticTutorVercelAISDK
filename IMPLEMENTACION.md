# Registro de implementación

La fuente pedagógica es `Contrato-pedagogico-y-pruebas.md` v0.3 (el nombre local difiere del citado por la guía). Los documentos originales se conservan.

El usuario solicita completar todo lo verificable sin API. Se mantienen H1 → H5 y sus verificaciones; los cierres se registran sin pedir autorización entre hitos. La generación real de H3 y la evaluación pedagógica humana quedan pendientes de la clave del usuario. No se sustituyen por resultados simulados.

El usuario proporcionará un Markdown académico breve. Por ahora `src/academic/scrum.md` reproduce el contexto provisional del contrato; eventos solo están nombrados. La fuente definitiva y su catálogo deberán quedar idénticos en ambas PoC antes de comparar resultados.

## H1 — Base y contratos

Completado: `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `src/domain/{contracts,rules}.ts`, `src/academic/*`, `src/fixtures/*`, `src/tests/fixtures.test.ts`.

Verificación: `npm.cmd run typecheck` correcto; `npm.cmd test`: 2/2; `git check-ignore .env`: ignorado. Node 24.19.0; AI SDK 7.0.148 / Anthropic 4.0.85. La red y `tsx` requirieron ejecución fuera del sandbox de Windows. No se modificó la política de PowerShell: se usa `npm.cmd`.

Limitación: corpus provisional a la espera del material solicitado. No se añaden conocimientos sobre eventos por cuenta propia.

## H2 — Reglas y estado

Completado: `src/services/{diagnostic,strategy,orchestrator,tutor-contract}.ts`, `src/domain/validation.ts`, `src/infrastructure/memory-store.ts`, `src/fixtures/mock-tutor.ts`, `src/tests/pedagogy.test.ts`.

`npm.cmd run typecheck`: correcto. `npm.cmd test`: 13/13; cero llamadas a Claude. Cubiertos E1–E5, pista explícita, verificación con evidencia anterior, entradas inválidas, privacidad y rollback. En E5 se genera directamente una pregunta INITIAL del nuevo tema, permitido por «selección o generación pertinente» del contrato; no se inventa una cuarta acción. RP10 sigue opcional, sin checkpoint automático.

## H3 — Tutor/Claude

Implementado: `src/config/*`, `src/services/{prompt,tutor}.ts`, instrumentación por intento en `src/infrastructure/attempt.ts` y `src/tests/tutor.test.ts`.

`npm.cmd run typecheck`: correcto. `npm.cmd test`: 21/21, sin API. Se prueba `generateText` y `Output.object` con `MockLanguageModelV4` del SDK instalado. Un intento normal, máximo dos ante salida inválida/429/503, uno ante 401; uso conocido preservado incluso en JSON inválido, desconocido como null. Timeout de 45 segundos por intento y espera de 500 ms antes del único reintento. No se registran cuerpos HTTP, claves ni mensajes crudos de error.

Pendiente explícito: generación real estructurada, revisión pedagógica y métricas reales. Se continúa H4/H5 para dejar la PoC lista sin requerir la clave, según la instrucción del usuario. Documentación contrastada: https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data, https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text, https://ai-sdk.dev/providers/ai-sdk-providers/anthropic.

## H4 — Orquestación y consola

Completado: `src/cli/{runtime,scenarios,demo}.ts`, integración de métricas en el orquestador, `src/tests/orchestration.test.ts`.

Verificación: `npm.cmd run typecheck` correcto; `npm.cmd test`: 26/26 en el cierre de H4. `npm.cmd run scenarios -- --mock --include-start`: E1–E5 y RP01 con estado técnico SUCCEEDED, cero llamadas a Claude. La consola se recorrió con `1`, `A`, `4`, `5`, `2`, `salir`: selección, respuesta, pista, cambio a eventos y cierre. Se guardaron ambos JSON.

Los turnos simultáneos sobre la misma sesión devuelven aclaración; respuestas a IDs anteriores no se aceptan. Dos intentos fallidos conservan íntegramente el estado, también al cambiar de tema. Un inicio fallido no crea sesión parcial. Transferencias positivas posteriores mantienen VERIFIED; la evidencia de antes de un cambio de tema no se reutiliza como evidencia activa.

## H5 — Medición y reporte

Completado: `src/infrastructure/metrics.ts`, exportación JSON en `src/cli/`, rúbrica literal con campos manuales null, `src/tests/metrics.test.ts`, README de reproducción y límites.

Verificación final: `npm.cmd run typecheck` correcto; `npm.cmd test`: **30/30**, cero solicitudes reales a Claude. Incluye transporte HTTP simulado del adaptador Anthropic, límites de reintento, ausencia de doble conteo y propagación de null. `git diff --check`: sin errores de whitespace. `.env`, dependencias, caché y resultados están ignorados; `.env.example` y `outputs/.gitkeep` permanecen versionables.

Resultados de escenarios (simulación; no puntuación pedagógica):

| Caso | Decisión | Comprensión posterior | Errores |
|---|---|---|---|
| E1 | VERIFY | PENDING_VERIFICATION | 0 |
| E2 | HINT | IN_PROGRESS | 1 |
| E3 | SIMPLIFY | IN_PROGRESS | 2 |
| E4 | HINT | IN_PROGRESS | 1 |
| E5 | CHANGE_TOPIC | UNASSESSED | 0 |

Artefactos locales de verificación:

- `outputs/scenarios-652c415a-93de-477f-80be-fabc5bc7764b.json`: cinco escenarios y RP01; incluye claves privadas para el evaluador.
- `outputs/demo-a1e0f82b-e5a7-4cb7-9950-c81bb99493cc.json`: recorrido de consola con respuestas públicas y métricas.

## Pendientes de validación real

1. Recibir e incorporar el Markdown académico breve que el usuario proporcionará; revisar respaldo de preguntas y catálogo, y fijar la misma fuente en ambas PoC.
2. Configurar la clave localmente. El usuario confirmó `claude-sonnet-4-6`: ya está fijado en `.env.example` y en el `.env` local, creado con la clave vacía. La clave no se solicita en el chat.
3. Ejecutar E1–E5 con Claude y completar la rúbrica manual sin cambiar los criterios. Esto cierra la verificación real de H3 y la aceptación pedagógica final.

No hay resultados empíricos sobre aprendizaje ni comparación real con LangChain/LangGraph. La implementación técnica sin API queda verificada; el corpus y la aceptación real siguen pendientes.
