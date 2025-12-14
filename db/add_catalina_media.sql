-- Add ultrasound media to Catalina case for on-demand access
-- This allows the AI to show the ultrasound when asked during the Test Results stage (or any stage)

UPDATE public.cases
SET media = COALESCE(media, '[]'::jsonb) || '[
  {
    "id": "catalina-us-1",
    "type": "image",
    "url": "https://images.unsplash.com/photo-1579154204601-01588f351e67?q=80&w=2070&auto=format&fit=crop", 
    "caption": "Ultrasound of submandibular lymph node showing hypoechoic core (abscessation) with surrounding edema.",
    "trigger": "on_demand",
    "stage": {
      "stageKey": "test-results"
    }
  },
  {
    "id": "catalina-audio-1",
    "type": "audio",
    "url": "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3",
    "caption": "Auscultation: Heart rate 48 bpm, regular rhythm.",
    "trigger": "on_demand",
    "stage": {
      "stageKey": "physical-examination"
    }
  }
]'::jsonb
WHERE slug = 'equine-strangles-catalina'
AND NOT (media @> '[{"id": "catalina-us-1"}]');
