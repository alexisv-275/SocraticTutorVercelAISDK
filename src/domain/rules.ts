import { readFileSync } from 'node:fs';

// Una sola fuente literal para las reglas y la rúbrica compartidas por las dos PoC.
const contract = readFileSync(new URL('../../Contrato-pedagogico-y-pruebas.md', import.meta.url), 'utf8');
export const PEDAGOGICAL_RULES = contract.split(/\r?\n/).filter(line => /^\| \*\*RP\d{2}/.test(line)).join('\n');
export const RUBRIC = Object.fromEntries(contract.split(/\r?\n/)
  .filter(line => /^- \*\*E[1-5]:/.test(line))
  .map(line => [line.match(/E[1-5]/)![0], line]));
if (PEDAGOGICAL_RULES.split('\n').length !== 10 || Object.keys(RUBRIC).length !== 5) {
  throw new Error('El contrato debe contener RP01–RP10 y la rúbrica de E1–E5.');
}
