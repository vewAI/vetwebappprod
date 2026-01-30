import { debugEventBus } from '@/lib/debug-events-fixed';
import { chatService } from '@/features/chat/services/chatService';
import type { Message } from '@/features/chat/models/chat';

export type SendPersonaGreetingDeps = {
  ensurePersonaMetadata: (personaKey: string) => Promise<any>;
  appendAssistantMessage: (m: Message) => void;
  playTtsAndPauseStt: (text: string, voice?: string, meta?: any, gender?: any, skipResume?: boolean) => Promise<void>;
  ttsEnabled: boolean;
  currentStageIndex: number;
  caseId?: string;
  isListening?: boolean;
};

export async function sendPersonaGreeting(personaKey: string, deps: SendPersonaGreetingDeps) {
  const { ensurePersonaMetadata, appendAssistantMessage, playTtsAndPauseStt, ttsEnabled, currentStageIndex, caseId, isListening } = deps;
  try {
    const personaMeta = await ensurePersonaMetadata(personaKey);
    const greeting = personaKey === 'owner' ? 'Hello Doctor' : (personaKey === 'veterinary-nurse' ? 'Hello Doc' : 'Hello');
    const assistantMsg = chatService.createAssistantMessage(
      greeting,
      currentStageIndex,
      personaMeta?.displayName ?? (personaKey === 'veterinary-nurse' ? 'Nurse' : 'Assistant'),
      personaMeta?.portraitUrl,
      personaMeta?.voiceId,
      personaMeta?.sex as any,
      personaKey
    );
    appendAssistantMessage(assistantMsg);
    if (ttsEnabled) {
      // For UI-driven greeting we should NOT force the mic to resume to avoid accidental auto-listen.
      const forceResume = false;
      // Emit telemetry so QA can detect UI based greetings that intentionally don't resume the mic
      try { debugEventBus.emitEvent?.('info','STT','persona_ui_greeting_no_resume',{ personaKey, wasListening: Boolean(isListening), reason: 'ui-greeting' }); } catch {}
      try {
        await playTtsAndPauseStt(greeting, personaMeta?.voiceId, { roleKey: personaKey, displayRole: assistantMsg.displayRole, role: personaKey, caseId, forceResume } as any, personaMeta?.sex as any);
      } catch (e) {
        // ignore tts errors
      }
    }
  } catch (e) {
    // non-blocking
  }
}
