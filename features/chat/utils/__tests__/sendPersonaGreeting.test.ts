import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPersonaGreeting } from '@/features/chat/utils/sendPersonaGreeting';
import { debugEventBus } from '@/lib/debug-events-fixed';

describe('sendPersonaGreeting', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calls playTtsAndPauseStt with forceResume:false for nurse UI greeting and emits telemetry', async () => {
    const ensurePersonaMetadata = vi.fn().mockResolvedValue({ displayName: 'Martin Lambert', portraitUrl: 'url', voiceId: 'voice1', sex: 'male' });
    const appendAssistantMessage = vi.fn();
    const playTtsAndPauseStt = vi.fn().mockResolvedValue(undefined);
    const emitSpy = vi.spyOn(debugEventBus as any, 'emitEvent').mockImplementation(() => {});

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
    expect(emitSpy).toHaveBeenCalledWith('info','STT','persona_ui_greeting_no_resume', expect.objectContaining({ personaKey: 'veterinary-nurse' }));
  });
});