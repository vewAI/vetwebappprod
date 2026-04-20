# Live Voice Sessions — Setup & Configuration Guide

## Overview

The **Live** feature provides a voice-first clinical simulation experience. Students speak directly with AI-powered personas (pet owner, veterinary nurse, lab technician) through a real-time bidirectional audio connection powered by the Gemini Live API.

Unlike the text-based chat interface, Live sessions are:
- **Voice-first** — interaction happens through spoken conversation
- **Mobile-optimized** — vertical layout designed for phones
- **Immersive** — personas respond with natural speech, emotions, and personality
- **Stage-aware** — personas automatically switch as the student progresses through the case

---

## Architecture

```
Browser Microphone
       │
       ▼
  PCM Audio (16kHz, S16LE)
       │
       ▼
  GeminiLiveService ◄──── WebSocket ────► Gemini Live API
       │                                    │
       │                                    ▼
       │                              AI Response (audio + text)
       │                                    │
       ▼                                    ▼
  useMicrophone                       useAudioPlayer
       │                                    │
       │                                    ▼
       │                              Browser Speakers
       │
       ▼
  usePersonaSwitcher ───► Stage detection ───► Persona swap
```

---

## Prerequisites

### 1. Gemini API Key

You need a Google AI Studio API key with access to the Gemini Live model.

```bash
# In your .env.local file
GEMINI_API_KEY=your_api_key_here
```

**Get a key at:** [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 2. Enable the Live Model

The Live feature uses the model `gemini-2.5-flash-preview-native-audio-dialog`. This model must be available on your API key.

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Navigate to your project settings
3. Ensure the **Gemini 2.5 Flash** models are enabled
4. The native audio dialog model should appear in the model selector

> **Note:** This model is in preview. Availability may vary by region and quota.

### 3. Browser Requirements

- **Microphone access** — the browser will prompt for mic permission
- **WebSocket support** — required for the Gemini Live connection
- **Web Audio API** — for audio playback
- **HTTPS** — required for `getUserMedia()` in production (localhost works over HTTP)

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | — | Google AI Studio API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | — | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | — | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Supabase service role key (for API routes) |

---

## File Structure

```
app/
├── live/
│   ├── page.tsx                          # Case selection landing page
│   └── [id]/
│       ├── layout.tsx                    # Full-screen mobile layout
│       └── page.tsx                      # Session entry point
├── api/live/
│   ├── token/route.ts                   # API key proxy (ephemeral tokens ready)
│   └── session/route.ts                 # Attempt creation + stage persistence

features/live/
├── types.ts                             # Shared types, constants, mappings
├── services/
│   ├── geminiLiveService.ts             # WebSocket connection manager
│   └── systemInstructionBuilder.ts      # Persona prompt generation
├── hooks/
│   ├── useGeminiLive.ts                 # Main connection hook
│   ├── useMicrophone.ts                 # Mic capture → PCM chunks
│   ├── useAudioPlayer.ts                # PCM playback via Web Audio
│   ├── usePersonaSwitcher.ts            # Stage → persona mapping
│   └── useLiveProgress.ts               # Stage progression tracking
└── components/
    ├── live-session.tsx                 # Main orchestrator
    ├── persona-header.tsx               # Portrait + name + stage pill
    ├── audio-waveform.tsx               # Canvas visualization
    ├── live-controls.tsx                # Mic button + actions
    ├── live-stage-progress.tsx          # Stage pill tracker
    └── live-transcript.tsx              # Pull-up transcript panel
```

---

## Stage-to-Persona Mapping

Personas switch automatically based on `stage.settings.stage_type`:

| Stage Type | Persona | Voice |
|---|---|---|
| `history` | Pet Owner | Conversational, concerned |
| `physical` | Veterinary Nurse | Professional, methodical |
| `diagnostic` | Pet Owner | Curious, worried |
| `laboratory` | Lab Technician | Precise, detail-oriented |
| `treatment` | Veterinary Nurse | Supportive, thorough |
| `communication` | Pet Owner | Receptive, emotional |

---

## How to Use

### As a Student

1. Click **Live** in the navigation bar
2. Browse available cases and click **Start Live Session** on any case
3. Grant microphone permission when prompted
4. Tap the microphone button to speak, tap again to stop
5. The AI persona will respond with voice
6. Progress through stages — the persona changes automatically
7. Use **Show transcript** to review the conversation as text
8. Tap **Next Stage** when you've completed enough turns (minimum 4)
9. End the session with the red phone button

### Navigation

```
Navbar → Live → /live (case selection) → /live/{caseId} (voice session)
```

---

## Running Locally

```bash
# 1. Set your Gemini API key
echo "GEMINI_API_KEY=your_key" >> .env.local

# 2. Start the dev server
npm run dev

# 3. Open the app and navigate to Live
open http://localhost:3000/live
```

---

## Troubleshooting

### "Gemini API key not configured"
- Ensure `GEMINI_API_KEY` is set in `.env.local`
- Restart the dev server after adding the variable

### "WebSocket connection error"
- Check that your API key is valid and has Gemini Live access
- Verify the model `gemini-2.5-flash-preview-native-audio-dialog` is available for your key
- Check browser console for detailed error messages

### Microphone not working
- Grant microphone permission when prompted
- Ensure you're on HTTPS in production (or localhost in development)
- Check that no other app is blocking the microphone

### No audio output
- Check browser volume and system audio output
- Ensure the mute button in Live Controls is not active
- Try a different browser (Chrome recommended for best Web Audio support)

### Personas not switching
- Check that stages have `stage_type` set in their `settings` field
- Verify the Stage Manager has configured stage types for the case

---

## Security Notes

- The Gemini API key is **server-side only** — the `/api/live/token` endpoint acts as a proxy, the key never reaches the client
- For production, implement ephemeral tokens from a Token Server instead of passing the raw API key
- All API routes require authentication via `requireUser()`
- Session data (attempts, progress) is stored in Supabase with RLS policies

---

## Production Upgrade Path

- **Ephemeral tokens:** Replace the raw API key proxy with Google's ephemeral token server for enhanced security
- **Multiple voice styles:** Add per-persona voice configuration using Gemini's `voice_config` options
- **Session recording:** Store audio transcripts for professor review and feedback
- **Push-to-talk vs. always-on:** Add a toggle for different interaction modes
- **Language selection:** Support multi-language conversations for international students
