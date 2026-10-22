import { StudySessionSchema, type StudySession } from '../domain/contracts.js';

export class MemorySessionStore {
  private readonly sessions = new Map<string, StudySession>();
  get(id: string): StudySession | undefined {
    const state = this.sessions.get(id);
    return state ? structuredClone(state) : undefined;
  }
  save(state: StudySession): void {
    this.sessions.set(state.sessionId, StudySessionSchema.parse(state));
  }
  reset(id: string): void { this.sessions.delete(id); }
}
