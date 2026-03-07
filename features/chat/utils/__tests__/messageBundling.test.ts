import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mergeStringsNoDup, shouldCoalesce, coalesceMessages } from '@/features/chat/utils/messageBundling';
import type { Message } from '@/features/chat/models/chat';

describe('messageBundling utils', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('mergeStringsNoDup avoids duplicated overlap', () => {
    const a = 'hello world';
    const b = 'world how are you';
    const merged = mergeStringsNoDup(a, b);
    expect(merged).toBe('hello world how are you');
  });

  it('shouldCoalesce true for recent same-persona messages', () => {
    const now = new Date().toISOString();
    const lastMsg: Message = { id: '1', role: 'user', content: 'I would like a blood draw', timestamp: now, personaRoleKey: 'veterinary-nurse' };
    const res = shouldCoalesce(lastMsg, 'veterinary-nurse', 'and a chemistry panel');
    expect(res).toBe(true);
  });

  it('shouldCoalesce false when persona differs', () => {
    const now = new Date().toISOString();
    const lastMsg: Message = { id: '1', role: 'user', content: 'I would like a blood draw', timestamp: now, personaRoleKey: 'owner' };
    const res = shouldCoalesce(lastMsg, 'veterinary-nurse', 'and a chemistry panel');
    expect(res).toBe(false);
  });

  it('coalesceMessages merges content and updates timestamps', () => {
    const now = new Date().toISOString();
    const lastMsg: Message = { id: '1', role: 'user', content: 'please check ECG', timestamp: now, personaRoleKey: 'veterinary-nurse' };
    const { messages, mergedMessage } = coalesceMessages([lastMsg], 'ECG and a chest xray', 'veterinary-nurse');
    expect(mergedMessage).not.toBeNull();
    expect(messages.length).toBe(1);
    expect(messages[0].content).toContain('ECG');
    expect(messages[0].timestamp).not.toBe(lastMsg.timestamp);
  });
});