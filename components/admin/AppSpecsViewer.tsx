"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface RolePromptDefinition {
  key: string;
  defaultTemplate: string;
  placeholderDocs: { token: string; description: string }[];
}

interface FindingsStrategy {
  value: string;
  description: string;
}

interface DefaultStage {
  id: string;
  title: string;
  role: string;
  roleInfoKey: string;
}

interface PersonaRoleKey {
  key: string;
  description: string;
}

interface VoiceProvider {
  provider: string;
  description: string;
}

interface STTConfig {
  provider: string;
  incompletePhraseSuffixes: string[];
  description: string;
}

interface TTSConfig {
  preDelay: number;
  suppressionClear: number;
  sttResumeDelay: number;
  deafWindowAfterTts: number;
  description: string;
}

interface PromptLayer {
  layer: number;
  name: string;
  description: string;
  example: string;
}

interface Responsibility {
  aspect: string;
  controlledBy: string;
}

interface PromptIntegration {
  title: string;
  layers: PromptLayer[];
  runtimeFlow: string[];
  responsibilities: Responsibility[];
  ownerGuardrails?: string[];
  nurseGuardrails?: string[];
}

interface AppSpecs {
  promptIntegration: PromptIntegration;
  rolePromptDefinitions: RolePromptDefinition[];
  findingsReleaseStrategies: FindingsStrategy[];
  defaultStages: DefaultStage[];
  personaRoleKeys: PersonaRoleKey[];
  voiceProviders: VoiceProvider[];
  sttConfig: STTConfig;
  ttsConfig: TTSConfig;
}

interface AppSpecsViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  return (
    <div className="border rounded-lg mb-2">
      <button
        className="w-full flex items-center justify-between p-3 text-left font-semibold hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
        <span className="text-muted-foreground">{isOpen ? "▼" : "▶"}</span>
      </button>
      {isOpen && <div className="p-3 pt-0 border-t">{children}</div>}
    </div>
  );
}

export function AppSpecsViewer({ open, onOpenChange }: AppSpecsViewerProps) {
  const [specs, setSpecs] = React.useState<AppSpecs | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedPrompt, setExpandedPrompt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && !specs) {
      setLoading(true);
      setError(null);
      fetch("/api/admin/app-specs")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load specs");
          return res.json();
        })
        .then((data) => setSpecs(data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [open, specs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📋 App Specifications Reference
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading && <p className="text-muted-foreground">Loading specs...</p>}
          {error && <p className="text-destructive">Error: {error}</p>}
          {specs && (
            <div className="space-y-2">
              {/* Prompt Integration Overview */}
              <CollapsibleSection
                title="🔗 How Prompts Integrate Together"
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    The AI behavior is composed of multiple layers that combine at runtime.
                  </p>
                  
                  {/* Layers */}
                  <div className="space-y-3">
                    {specs.promptIntegration.layers.map((layer) => (
                      <div key={layer.layer} className="border rounded-md p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="w-6 h-6 flex items-center justify-center rounded-full shrink-0">
                            {layer.layer}
                          </Badge>
                          <span className="font-semibold">{layer.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {layer.description}
                        </p>
                        <pre className="text-xs bg-muted p-2 rounded-md whitespace-pre-wrap font-mono">
                          {layer.example}
                        </pre>
                      </div>
                    ))}
                  </div>

                  {/* Runtime Flow */}
                  <div>
                    <h4 className="font-medium mb-2">Runtime Flow</h4>
                    <div className="bg-muted rounded-md p-3 space-y-1">
                      {specs.promptIntegration.runtimeFlow.map((step, idx) => (
                        <div key={idx} className="text-sm font-mono">
                          {step}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Responsibilities */}
                  <div>
                    <h4 className="font-medium mb-2">Division of Responsibility</h4>
                    <div className="space-y-1">
                      {specs.promptIntegration.responsibilities.map((r, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm"
                        >
                          <span className="font-medium min-w-[200px]">{r.aspect}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-muted-foreground">{r.controlledBy}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Guardrails */}
                  <div className="grid grid-cols-2 gap-4">
                    {specs.promptIntegration.ownerGuardrails && (
                      <div>
                        <h4 className="font-medium mb-2 text-amber-600">🐄 Owner Guardrails</h4>
                        <div className="bg-amber-50 dark:bg-amber-950/30 rounded-md p-3 space-y-1">
                          {specs.promptIntegration.ownerGuardrails.map((rule, idx) => (
                            <div key={idx} className="text-sm flex items-start gap-2">
                              <span className="text-amber-600">•</span>
                              <span>{rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {specs.promptIntegration.nurseGuardrails && (
                      <div>
                        <h4 className="font-medium mb-2 text-blue-600">👩‍⚕️ Nurse/Tech Guardrails</h4>
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3 space-y-1">
                          {specs.promptIntegration.nurseGuardrails.map((rule, idx) => (
                            <div key={idx} className="text-sm flex items-start gap-2">
                              <span className="text-blue-600">•</span>
                              <span>{rule}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Role Prompt Definitions */}
              <CollapsibleSection
                title={`Role Prompt Definitions (${specs.rolePromptDefinitions.length})`}
                defaultOpen={false}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Core prompts for each role in case stages. Define how AI behaves as owner, nurse, or technician. These now include STRICT GUARDRAILS built in.
                </p>
                <div className="space-y-2">
                  {specs.rolePromptDefinitions.map((prompt) => (
                    <div key={prompt.key} className="border rounded-md">
                      <button
                        className="w-full flex items-center justify-between p-2 text-left text-sm font-mono hover:bg-muted/50"
                        onClick={() =>
                          setExpandedPrompt(expandedPrompt === prompt.key ? null : prompt.key)
                        }
                      >
                        {prompt.key}
                        <span className="text-muted-foreground text-xs">
                          {expandedPrompt === prompt.key ? "▼" : "▶"}
                        </span>
                      </button>
                      {expandedPrompt === prompt.key && (
                        <div className="p-3 border-t space-y-3">
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                              Placeholders:
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {prompt.placeholderDocs.map((ph) => (
                                <Badge
                                  key={ph.token}
                                  variant="outline"
                                  className="text-xs cursor-help"
                                  title={ph.description}
                                >
                                  {ph.token}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground mb-1">
                              Template:
                            </h4>
                            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                              {prompt.defaultTemplate}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Findings Release Strategies */}
              <CollapsibleSection title="Findings Release Strategies">
                <p className="text-sm text-muted-foreground mb-4">
                  Controls how physical exam and diagnostic findings are revealed to students.
                </p>
                <div className="space-y-2">
                  {specs.findingsReleaseStrategies.map((strategy) => (
                    <div
                      key={strategy.value}
                      className="flex items-start gap-3 p-3 bg-muted rounded-md"
                    >
                      <Badge variant="secondary" className="font-mono shrink-0">
                        {strategy.value}
                      </Badge>
                      <span className="text-sm">{strategy.description}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Default Stages */}
              <CollapsibleSection title="Default Case Stages">
                <p className="text-sm text-muted-foreground mb-4">
                  Standard progression of stages for veterinary cases.
                </p>
                <div className="space-y-2">
                  {specs.defaultStages.map((stage, idx) => (
                    <div
                      key={stage.id}
                      className="flex items-center gap-3 p-3 bg-muted rounded-md"
                    >
                      <Badge className="w-6 h-6 flex items-center justify-center rounded-full shrink-0">
                        {idx + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{stage.title}</span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="text-sm text-muted-foreground">{stage.role}</span>
                      </div>
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {stage.roleInfoKey}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Persona Role Keys */}
              <CollapsibleSection title="Persona Role Keys">
                <p className="text-sm text-muted-foreground mb-4">
                  The two main persona categories configurable per case.
                </p>
                <div className="space-y-2">
                  {specs.personaRoleKeys.map((role) => (
                    <div
                      key={role.key}
                      className="flex items-center gap-3 p-3 bg-muted rounded-md"
                    >
                      <Badge variant="secondary" className="font-mono">
                        {role.key}
                      </Badge>
                      <span className="text-sm">{role.description}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>

              {/* Voice Configuration */}
              <CollapsibleSection title="Voice Configuration (TTS/STT)">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-2">TTS Providers</h4>
                    <div className="space-y-2">
                      {specs.voiceProviders.map((vp) => (
                        <div
                          key={vp.provider}
                          className="flex items-center gap-3 p-3 bg-muted rounded-md"
                        >
                          <Badge variant="secondary" className="font-mono">
                            {vp.provider}
                          </Badge>
                          <span className="text-sm">{vp.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">TTS Timing Configuration</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      {specs.ttsConfig.description}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="p-3 bg-muted rounded-md text-center">
                        <div className="text-2xl font-mono font-bold">
                          {specs.ttsConfig.preDelay}
                        </div>
                        <div className="text-xs text-muted-foreground">Pre-delay (ms)</div>
                      </div>
                      <div className="p-3 bg-muted rounded-md text-center">
                        <div className="text-2xl font-mono font-bold">
                          {specs.ttsConfig.suppressionClear}
                        </div>
                        <div className="text-xs text-muted-foreground">Suppression (ms)</div>
                      </div>
                      <div className="p-3 bg-muted rounded-md text-center">
                        <div className="text-2xl font-mono font-bold">
                          {specs.ttsConfig.sttResumeDelay}
                        </div>
                        <div className="text-xs text-muted-foreground">STT resume (ms)</div>
                      </div>
                      <div className="p-3 bg-muted rounded-md text-center">
                        <div className="text-2xl font-mono font-bold">
                          {specs.ttsConfig.deafWindowAfterTts}
                        </div>
                        <div className="text-xs text-muted-foreground">Deaf window (ms)</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Quick reference: <strong>Pre-delay</strong> is the pause (ms) before TTS starts so the mic can be stopped; <strong>Suppression</strong> is how long STT is held suppressed immediately around playback; <strong>STT resume</strong> is the delay before attempting to restart listening after playback ends; <strong>Deaf window</strong> is a short period after TTS where all recognition results are ignored to catch echoes.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">STT Configuration</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Provider: <Badge variant="outline">{specs.sttConfig.provider}</Badge>
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      {specs.sttConfig.description}
                    </p>
                    <div className="p-3 bg-muted rounded-md">
                      <div className="text-xs text-muted-foreground mb-1">
                        Incomplete phrase suffixes ({specs.sttConfig.incompletePhraseSuffixes.length} words):
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {specs.sttConfig.incompletePhraseSuffixes.slice(0, 30).map((word) => (
                          <Badge key={word} variant="outline" className="text-xs">
                            {word}
                          </Badge>
                        ))}
                        {specs.sttConfig.incompletePhraseSuffixes.length > 30 && (
                          <Badge variant="outline" className="text-xs">
                            +{specs.sttConfig.incompletePhraseSuffixes.length - 30} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
