import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPersonaGreeting } from '@/features/chat/utils/sendPersonaGreeting';

describe('sendPersonaGreeting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calls playTtsAndPauseStt with forceResume:false for nurse UI greeting', async () => {
    const ensurePersonaMetadata = vi.fn().mockResolvedValue({ displayName: 'Martin Lambert', portraitUrl: 'url', voiceId: 'voice1', sex: 'male' });
    const appendAssistantMessage = vi.fn();
    const playTtsAndPauseStt = vi.fn().mockResolvedValue(undefined);
    await sendPersonaGreeting('veterinary-nurse', {
      ensurePersonaMetadata,
      appendAssistantMessage,
      playTtsAndPauseStt,
      ttsEnabled: true,
      currentStageIndex: 0,
      caseId: 'case-1',
      isListening: false,
    });

    expect(ensurePersonaMetadata).toHaveBeenCalledWith('veterinary-nurse');
    expect(appendAssistantMessage).toHaveBeenCalled();
    expect(playTtsAndPauseStt).toHaveBeenCalledTimes(1);
    const args = playTtsAndPauseStt.mock.calls[0];
    const opts = args[2] || {};
    expect(opts.forceResume).toBe(false);
  });
});