import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { TOPICS } from '../academic/context.js';
import type { PublicTurnResponse, StudentAction } from '../domain/contracts.js';
import { createRuntime, reportCliError, saveReport } from './runtime.js';

function display(response: PublicTurnResponse) {
  console.log(`\n${response.message}`);
  if (response.topics) response.topics.forEach((topic, index) => console.log(`${index + 1}. ${topic.title}`));
  if (response.question) {
    console.log(response.question.text);
    for (const [id, text] of Object.entries(response.question.options)) console.log(`${id}. ${text}`);
    response.actions.forEach(action => console.log(action));
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--mock')) { console.error('Uso: npm run dev -- [--mock]'); process.exitCode = 1; return; }
  const runtime = createRuntime(args.includes('--mock'));
  console.log(args.includes('--mock') ? 'ThinkAgora — simulación local, sin Claude.' : 'ThinkAgora — Tutor Claude.');
  console.log('Escribe salir para terminar. Cada respuesta o pista válida genera una intervención.');
  const sessionId = randomUUID();
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  async function ask(prompt: string) {
    process.stdout.write(prompt); const next = await iterator.next();
    return next.done ? 'salir' : next.value.trim();
  }
  const responses: PublicTurnResponse[] = [];
  try {
    let response = await runtime.orchestrator.startSession(sessionId);
    responses.push(response); display(response);
    while (runtime.orchestrator.getSession(sessionId)) {
      const choice = (await ask('\nTu elección (o salir): ')).toLowerCase();
      if (choice === 'salir') break;
      const state = runtime.orchestrator.getSession(sessionId)!;
      let action: unknown;
      if (!state.currentQuestion || choice === '5') {
        let selected = choice;
        if (state.currentQuestion) {
          TOPICS.forEach((topic, index) => console.log(`${index + 1}. ${topic.title}`));
          selected = await ask('Tema (1–3, o salir): ');
          if (selected.toLowerCase() === 'salir') break;
        }
        const topic = /^[1-3]$/.test(selected) ? TOPICS[Number(selected) - 1] : undefined;
        action = { action: 'CHANGE_TOPIC', targetTopicId: topic?.id ?? selected };
      } else if (choice === '4') {
        action = { action: 'REQUEST_HINT', questionId: state.currentQuestion.id } satisfies StudentAction;
      } else {
        const option = ({ '1': 'A', '2': 'B', '3': 'C' } as Record<string, string>)[choice] ?? choice.toUpperCase();
        action = { action: 'ANSWER', questionId: state.currentQuestion.id, selectedOptionId: option };
      }
      response = await runtime.orchestrator.handleTurn(sessionId, action);
      responses.push(response); display(response);
    }
  } finally {
    lines.close();
    const file = await saveReport('demo', runtime.metrics.runId, { ...runtime.metadata, responses, metrics: runtime.metrics.export() });
    console.log(`\nRegistro de la demo: ${file}`);
    if (runtime.metrics.export().some(m => m.status === 'FAILED')) process.exitCode = 1;
  }
}
main().catch(reportCliError);
