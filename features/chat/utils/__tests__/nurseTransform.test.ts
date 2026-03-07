import { describe, it, expect } from 'vitest';
import { transformNurseAssistantMessage } from '@/features/chat/utils/nurseTransform';
import type { Message } from '@/features/chat/models/chat';

const makeMessage = (content: string, persona = 'veterinary-nurse'): Message => ({ id: 'm1', role: 'assistant', content, timestamp: new Date().toISOString(), personaRoleKey: persona });
const makeStage = (title = 'Physical Examination', role = 'nurse') => ({ id: 's1', title, role } as any);

describe('transformNurseAssistantMessage', () => {
  it('suppresses large findings dump when user did not request keys', () => {
    const ai = makeMessage('HR: 38 | RR: 16 | Temp: 101.4 | BP: 120/70 | lots of findings summary ...');
    const res = transformNurseAssistantMessage(ai, makeStage(), '');
    expect(res.allowTts).toBe(false);
    expect(res.message.content).toContain('I can provide specific physical findings');
  });

  it('allows full findings when user explicitly requested keys', () => {
    const ai = makeMessage('HR: 38 | RR: 16 | Temp: 101.4');
    const res = transformNurseAssistantMessage(ai, makeStage(), "please show hr, rr");
    expect(res.allowTts).toBe(true);
    expect(res.message.content).toBe(ai.content);
  });

  it('allows short content even in nurse/physical stage', () => {
    const ai = makeMessage('Not documented.');
    const res = transformNurseAssistantMessage(ai, makeStage(), '');
    expect(res.allowTts).toBe(true);
    expect(res.message.content).toContain("I don't see that recorded");
  });
});