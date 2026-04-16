"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ThinkingAnimation from "./ThinkingAnimation";
import { caseVerificationService } from "../services/caseVerificationService";
import type { CaseVerificationItem, CaseVerificationResult, VerificationChatMessage } from "../models/caseVerification";

/* ── Relevance → visual style mapping ── */
const RELEVANCE_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  mandatory: { dot: "bg-red-500", label: "Mandatory", bg: "bg-red-50 border-red-200" },
  recommended: { dot: "bg-orange-400", label: "Recommended", bg: "bg-orange-50 border-orange-200" },
  optional: { dot: "bg-yellow-400", label: "Optional", bg: "bg-yellow-50 border-yellow-200" },
  unnecessary: { dot: "bg-gray-300", label: "Unnecessary", bg: "bg-gray-50 border-gray-200" },
};

const STATUS_ICONS: Record<string, string> = {
  pending: "○",
  accepted: "✓",
  answered: "✓",
  skipped: "—",
};

interface VerificationChatbotProps {
  open: boolean;
  onClose: () => void;
  verificationResult: CaseVerificationResult;
  caseContext: {
    species: string;
    condition: string;
    patientName: string;
    category: string;
  };
  onFieldResolved: (targetField: string, value: string, writeMode: "append" | "replace") => void;
  onComplete: (emptyFields?: string[]) => void; // Optional param for empty fields that need auto-fill
}

export function VerificationChatbot({ open, onClose, verificationResult, caseContext, onFieldResolved, onComplete }: VerificationChatbotProps) {
  // Filter: only show items that are MISSING (alreadyPresent: false)
  // Skip items that already exist in the case data
  const missingItems = verificationResult.items.filter((item) => !item.alreadyPresent);

  const [items, setItems] = useState<CaseVerificationItem[]>(missingItems);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [chatHistories, setChatHistories] = useState<Record<string, VerificationChatMessage[]>>({});
  const [inputText, setInputText] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorText, setEditorText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showingSuggestion, setShowingSuggestion] = useState(false);
  const [suggestedValue, setSuggestedValue] = useState("");
  const [waitingForSuggestion, setWaitingForSuggestion] = useState(false);
  const [isEditingFromSuggestion, setIsEditingFromSuggestion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageIdCounterRef = useRef(0);

  // Track which fields have been modified during THIS verification session
  // This ensures that multiple items writing to the same field append instead of replace
  const fieldsModifiedThisSession = useRef<Set<string>>(new Set());

  // Generate unique message IDs to avoid React key collisions
  // Use only counter (guarantees uniqueness per session, never repeats)
  const generateMessageId = (prefix: string): string => {
    messageIdCounterRef.current += 1;
    return `${prefix}-${messageIdCounterRef.current}`;
  };

  const activeItem: CaseVerificationItem | undefined = items[activeItemIndex];
  const activeItemId = activeItem?.id ?? "";

  const currentChat = chatHistories[activeItemId] ?? [];

  // Helper function to find next pending item following visual order (mandatory → recommended → optional)
  const findNextPendingItemByRelevance = useCallback((currentIdx: number, itemsList: CaseVerificationItem[]): number => {
    const relevanceOrder = { mandatory: 0, recommended: 1, optional: 2, unnecessary: 3 };

    // Sort items by relevance order, then by their original position
    const sortedIndices = itemsList
      .map((item, idx) => ({
        idx,
        relevance: relevanceOrder[item.relevance] ?? 999,
        item,
      }))
      .sort((a, b) => {
        if (a.relevance !== b.relevance) return a.relevance - b.relevance;
        return a.idx - b.idx;
      });

    // Find the next pending item after current item (in visual order)
    const currentRelevance = itemsList[currentIdx]?.relevance ?? "unnecessary";
    const currentRelevanceOrder = relevanceOrder[currentRelevance];

    let foundCurrent = false;
    for (const { idx, item } of sortedIndices) {
      if (idx === currentIdx) {
        foundCurrent = true;
        continue;
      }
      if (foundCurrent && item.status === "pending" && item.relevance !== "unnecessary") {
        console.log(`[VERIFICATION] Auto-advancing: ${itemsList[currentIdx]?.itemName} → ${item.itemName}`);
        return idx;
      }
    }

    return -1; // No more pending items
  }, []);

  // Count resolved items (only non-unnecessary)
  const actionableItems = useMemo(() => items.filter((i) => i.relevance !== "unnecessary"), [items]);
  const resolvedCount = useMemo(
    () => actionableItems.filter((i) => i.status === "accepted" || i.status === "answered" || i.status === "skipped").length,
    [actionableItems],
  );
  const allResolved = resolvedCount >= actionableItems.length && actionableItems.length > 0;

  // Track mandatory items separately - finish button should be available when all mandatory are done
  const mandatoryItems = useMemo(() => items.filter((i) => i.relevance === "mandatory"), [items]);
  const mandatoryResolved = useMemo(
    () => mandatoryItems.filter((i) => i.status === "accepted" || i.status === "answered" || i.status === "skipped").length,
    [mandatoryItems],
  );
  const allMandatoryResolved = mandatoryResolved >= mandatoryItems.length && mandatoryItems.length > 0;

  // Calculate live completion percentage based on current items state
  const liveCompletionPercentage = useMemo(() => {
    if (actionableItems.length === 0) return 0;
    return Math.round((resolvedCount / actionableItems.length) * 100);
  }, [resolvedCount, actionableItems.length]);

  // Auto-scroll chat to bottom and auto-focus input after chat updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat.length]);

  // Auto-focus input when ready for input
  useEffect(() => {
    if (activeItem?.status === "pending" && !isSending && !waitingForSuggestion && !showingSuggestion) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [currentChat.length, isSending, waitingForSuggestion, showingSuggestion, activeItem?.status, activeItem?.id]);

  // Auto-greet when switching to a new item with no history
  useEffect(() => {
    if (!activeItem) return;
    if (chatHistories[activeItem.id]?.length) return;
    let greetingText: string;
    if (activeItem.alreadyPresent && activeItem.existingValue) {
      greetingText =
        `The AI extracted this for **${activeItem.itemName}**:\n\n` +
        `> ${activeItem.existingValue.split("\n").join("\n> ")}\n\n` +
        `Does this look correct and complete? You can **Approve** it as-is, ` +
        `click **Edit** to modify it, or we can discuss what's missing. ` +
        `${activeItem.reasoning}`;
    } else {
      greetingText = activeItem.suggestedPrompt || `Could you provide information about: ${activeItem.itemName}?`;
    }

    const greeting: VerificationChatMessage = {
      id: `greeting-${activeItem.id}`,
      role: "assistant",
      content: greetingText,
      verificationItemId: activeItem.id,
      timestamp: new Date().toISOString(),
    };

    setChatHistories((prev) => ({
      ...prev,
      [activeItem.id]: [greeting],
    }));
  }, [activeItem, chatHistories]);

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const sourceText = overrideText !== undefined ? overrideText : inputText;
      if (!sourceText.trim() || !activeItem || isSending) return;
      const userText = sourceText.trim();

      // If editing from suggestion, save directly without LLM processing
      if (isEditingFromSuggestion) {
        console.log(`[VERIFICATION] Saving edited text directly (not sending to LLM): ${activeItem.itemName}`);
        setInputText("");
        setIsEditingFromSuggestion(false);
        setShowingSuggestion(false);
        setSuggestedValue("");

        // Write the edited value directly to the form
        // If the field was already modified in this session OR had content originally, append the new data; otherwise replace
        const hasExistingContent = activeItem.alreadyPresent && activeItem.existingValue;
        const wasModifiedThisSession = fieldsModifiedThisSession.current.has(activeItem.targetField);
        const writeMode = hasExistingContent || wasModifiedThisSession ? "append" : "replace";

        console.log(
          `[VERIFICATION] Field "${activeItem.targetField}" writeMode="${writeMode}" (hasExisting=${hasExistingContent}, modifiedThisSession=${wasModifiedThisSession})`,
        );

        onFieldResolved(activeItem.targetField, userText, writeMode);

        // Track that this field has been modified in this session
        fieldsModifiedThisSession.current.add(activeItem.targetField);

        // Update item status and auto-advance
        setItems((prevItems) => {
          const updatedItems = prevItems.map((item, idx) =>
            idx === activeItemIndex ? { ...item, status: "answered" as const, professorAnswer: userText } : item,
          );

          // Schedule auto-advance
          setTimeout(() => {
            const nextIdx = findNextPendingItemByRelevance(activeItemIndex, updatedItems);
            if (nextIdx !== -1) {
              setActiveItemIndex(nextIdx);
              setShowingSuggestion(false);
              setSuggestedValue("");
              setInputText("");
            }
          }, 400);

          return updatedItems;
        });
        return; // Exit early, don't send to LLM
      }

      setInputText("");
      setIsSending(true);

      const userMsg: VerificationChatMessage = {
        id: generateMessageId("user"),
        role: "user",
        content: userText,
        verificationItemId: activeItem.id,
        timestamp: new Date().toISOString(),
      };

      const updatedChat = [...(chatHistories[activeItem.id] ?? []), userMsg];
      setChatHistories((prev) => ({
        ...prev,
        [activeItem.id]: updatedChat,
      }));

      try {
        // Build messages for the API (exclude greeting system messages, just role+content)
        const apiMessages = updatedChat.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await caseVerificationService.chat({
          messages: apiMessages,
          currentItem: activeItem,
          caseContext,
        });

        // Check if response is a result (contains "Here's the result" or similar patterns)
        const isResult =
          response.reply.toLowerCase().includes("here's the result") || response.reply.toLowerCase().includes("final answer") || response.isResolved;

        const assistantMsg: VerificationChatMessage = {
          id: generateMessageId("assistant"),
          role: "assistant",
          content: response.reply,
          verificationItemId: activeItem.id,
          timestamp: new Date().toISOString(),
        };

        setChatHistories((prev) => ({
          ...prev,
          [activeItem.id]: [...(prev[activeItem.id] ?? []), userMsg, assistantMsg].filter(
            (msg, idx, arr) => arr.findIndex((m) => m.id === msg.id) === idx,
          ),
        }));

        if (isResult && response.extractedValue) {
          setSuggestedValue(response.extractedValue);
          setShowingSuggestion(true);
        } else if (response.isResolved) {
          // Write value into form
          if (response.extractedValue) {
            // Determine writeMode: if field was already modified in this session, always append
            const wasModifiedThisSession = fieldsModifiedThisSession.current.has(response.targetField);
            const finalWriteMode = wasModifiedThisSession ? "append" : response.writeMode;

            console.log(
              `[VERIFICATION] Resolving field "${response.targetField}" writeMode="${finalWriteMode}" (wasModifiedThisSession=${wasModifiedThisSession}, originalMode="${response.writeMode}")`,
            );

            onFieldResolved(response.targetField, response.extractedValue, finalWriteMode);

            // Track that this field has been modified in this session
            fieldsModifiedThisSession.current.add(response.targetField);
          }

          // Update item status AND schedule auto-advance via state updater
          setItems((prevItems) => {
            const updatedItems = prevItems.map((item, idx) =>
              idx === activeItemIndex
                ? {
                    ...item,
                    status: (response.extractedValue ? "answered" : "skipped") as "answered" | "skipped",
                    professorAnswer: response.extractedValue ?? "",
                  }
                : item,
            );

            // Auto-advance using the updated items array, respecting visual order
            setTimeout(() => {
              const nextIdx = findNextPendingItemByRelevance(activeItemIndex, updatedItems);
              if (nextIdx !== -1) {
                setActiveItemIndex(nextIdx);
                setShowingSuggestion(false);
                setSuggestedValue("");
                setInputText("");
              }
            }, 400);

            return updatedItems;
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Connection error";
        const errorAssistantMsg: VerificationChatMessage = {
          id: generateMessageId("error"),
          role: "assistant",
          content: `Error: ${errMsg}. Please try again.`,
          verificationItemId: activeItem.id,
          timestamp: new Date().toISOString(),
        };
        setChatHistories((prev) => ({
          ...prev,
          [activeItem.id]: [...(prev[activeItem.id] ?? []), errorAssistantMsg],
        }));
      } finally {
        setIsSending(false);
      }
    },
    [
      inputText,
      activeItem,
      activeItemIndex,
      isSending,
      chatHistories,
      caseContext,
      onFieldResolved,
      findNextPendingItemByRelevance,
      isEditingFromSuggestion,
    ],
  );

  const handleSkip = useCallback(() => {
    if (!activeItem) return;
    setItems((prevItems) => {
      const updatedItems = prevItems.map((item, idx) => (idx === activeItemIndex ? { ...item, status: "skipped" as const } : item));

      // Advance to next pending, respecting visual order
      const nextIdx = findNextPendingItemByRelevance(activeItemIndex, updatedItems);
      if (nextIdx !== -1) {
        setTimeout(() => {
          setActiveItemIndex(nextIdx);
          setShowingSuggestion(false);
          setSuggestedValue("");
          setInputText("");
        }, 0);
      }
      return updatedItems;
    });
  }, [activeItem, activeItemIndex, findNextPendingItemByRelevance]);

  const handleConfirmPresent = useCallback(() => {
    if (!activeItem) return;
    // Write the existing value into the form when the professor confirms
    if (activeItem.existingValue) {
      console.log(`[VERIFICATION] Confirming "${activeItem.itemName}" already present, appending to field "${activeItem.targetField}"`);
      onFieldResolved(activeItem.targetField, activeItem.existingValue, "append");
      // Track that this field has been modified in this session
      fieldsModifiedThisSession.current.add(activeItem.targetField);
    }
    setItems((prevItems) => {
      const updatedItems = prevItems.map((item, idx) => (idx === activeItemIndex ? { ...item, status: "accepted" as const } : item));

      // Advance to next pending, respecting visual order
      const nextIdx = findNextPendingItemByRelevance(activeItemIndex, updatedItems);
      if (nextIdx !== -1) {
        setTimeout(() => {
          setActiveItemIndex(nextIdx);
          setShowingSuggestion(false);
          setSuggestedValue("");
          setInputText("");
        }, 0);
      }
      return updatedItems;
    });
  }, [activeItem, activeItemIndex, onFieldResolved, findNextPendingItemByRelevance]);

  const handleGetAISuggestion = useCallback(async () => {
    if (!activeItem) return;
    setWaitingForSuggestion(true);

    const suggestPrompt = `Based on this ${caseContext.species} case with ${caseContext.condition}, what specific realistic and clinically relevant data should be provided for "${activeItem.itemName}"? 
    
    Consider:
    - The patient: ${caseContext.patientName}
    - Typical presentations and findings for this condition
    - What a veterinary student would expect to see
    - Specific values, measurements, or observations (with units where applicable)
    
    Provide a detailed, realistic suggestion that would be appropriate for teaching this case.`;

    const userMsg: VerificationChatMessage = {
      id: generateMessageId("user-suggestion"),
      role: "user",
      content: suggestPrompt,
      verificationItemId: activeItem.id,
      timestamp: new Date().toISOString(),
    };

    const updatedChat = [...(chatHistories[activeItem.id] ?? []), userMsg];
    setChatHistories((prev) => ({
      ...prev,
      [activeItem.id]: updatedChat,
    }));

    try {
      const apiMessages = updatedChat.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await caseVerificationService.chat({
        messages: apiMessages,
        currentItem: activeItem,
        caseContext,
      });

      const assistantMsg: VerificationChatMessage = {
        id: generateMessageId("assistant"),
        role: "assistant",
        content: response.reply,
        verificationItemId: activeItem.id,
        timestamp: new Date().toISOString(),
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeItem.id]: [...(prev[activeItem.id] ?? []), userMsg, assistantMsg],
      }));

      if (response.extractedValue) {
        setSuggestedValue(response.extractedValue);
        setShowingSuggestion(true);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Connection error";
      const errorAssistantMsg: VerificationChatMessage = {
        id: generateMessageId("error"),
        role: "assistant",
        content: `Error: ${errMsg}. Please try again.`,
        verificationItemId: activeItem.id,
        timestamp: new Date().toISOString(),
      };
      setChatHistories((prev) => ({
        ...prev,
        [activeItem.id]: [...(prev[activeItem.id] ?? []), errorAssistantMsg],
      }));
    } finally {
      setWaitingForSuggestion(false);
    }
  }, [activeItem, chatHistories, caseContext]);

  const handleApproveSuggestion = useCallback(() => {
    if (!activeItem || !suggestedValue) return;

    console.log(`[VERIFICATION] Approving suggestion for "${activeItem.itemName}" into field "${activeItem.targetField}"`);
    onFieldResolved(activeItem.targetField, suggestedValue, "append");

    // Track that this field has been modified in this session
    fieldsModifiedThisSession.current.add(activeItem.targetField);

    setItems((prevItems) => {
      const updatedItems = prevItems.map((item, idx) =>
        idx === activeItemIndex ? { ...item, status: "answered" as const, professorAnswer: suggestedValue } : item,
      );

      // Schedule auto-advance, respecting visual order
      setTimeout(() => {
        const nextIdx = findNextPendingItemByRelevance(activeItemIndex, updatedItems);
        if (nextIdx !== -1) {
          setActiveItemIndex(nextIdx);
          setShowingSuggestion(false);
          setSuggestedValue("");
          setInputText("");
        }
      }, 400);

      return updatedItems;
    });
  }, [activeItem, suggestedValue, activeItemIndex, onFieldResolved, findNextPendingItemByRelevance]);

  const handleEditSuggestion = useCallback(() => {
    if (!suggestedValue) return;
    setShowingSuggestion(false);
    setInputText(suggestedValue);
    setIsEditingFromSuggestion(true); // Mark that we're editing from a suggestion
  }, [suggestedValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="p-4 border-b shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
          <DialogTitle className="text-lg dark:text-white">Case Verification</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-300">{verificationResult.overallAssessment}</DialogDescription>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="font-medium dark:text-slate-200">Completeness: {liveCompletionPercentage}%</span>
            <span className="text-slate-500 dark:text-slate-400">
              {resolvedCount}/{actionableItems.length} items reviewed
            </span>
            {allResolved && <span className="text-emerald-600 dark:text-emerald-400 font-medium">✓ Verification complete</span>}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                caseVerificationService.downloadVerificationQuestions(items, {
                  caseId: (verificationResult as any)?.caseId,
                  title: (verificationResult as any)?.title,
                  species: caseContext.species,
                  condition: caseContext.condition,
                  patientName: caseContext.patientName,
                })
              }
            >
              Download Questions
            </Button>
          </div>
        </DialogHeader>

        {/* ── Body: sidebar + chat ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar: item list ── */}
          <div className="w-72 border-r overflow-y-auto shrink-0 bg-muted/30 dark:bg-slate-800/50 dark:border-slate-700">
            {(["mandatory", "recommended", "optional", "unnecessary"] as const).map((relevance) => {
              const group = items.filter((i) => i.relevance === relevance);
              if (group.length === 0) return null;
              const style = RELEVANCE_STYLES[relevance];
              return (
                <div key={relevance} className="py-2">
                  <div className="px-3 py-1 text-xs font-semibold text-muted-foreground dark:text-slate-400 uppercase tracking-wide flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    {style.label} ({group.length})
                  </div>
                  {group.map((item) => {
                    const itemIdx = items.indexOf(item);
                    const isActive = itemIdx === activeItemIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveItemIndex(itemIdx)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors dark:text-slate-200 ${
                          isActive ? "bg-accent font-medium dark:bg-slate-700" : "dark:text-slate-300"
                        }`}
                      >
                        <span
                          className={`text-xs ${
                            item.status === "answered" || item.status === "accepted"
                              ? "text-emerald-600"
                              : item.status === "skipped"
                                ? "text-muted-foreground"
                                : "text-muted-foreground/50"
                          }`}
                        >
                          {STATUS_ICONS[item.status]}
                        </span>
                        <span className="truncate">{item.itemName}</span>
                        {item.alreadyPresent && item.status === "pending" && <span className="ml-auto text-xs text-blue-500 shrink-0">✎</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* ── Chat panel ── */}
          <div className="flex-1 flex flex-col">
            {activeItem ? (
              <>
                {/* Item header */}
                <div className={`p-3 border-b text-sm ${RELEVANCE_STYLES[activeItem.relevance]?.bg ?? ""}`}>
                  <div className="font-medium dark:text-white">{activeItem.itemName}</div>
                  <div className="text-xs text-muted-foreground dark:text-slate-300 mt-1">
                    {activeItem.category} · {activeItem.relevance} · Frequency: {activeItem.expectedFrequency}
                    {activeItem.alreadyPresent && <span className="ml-2 text-blue-600 dark:text-blue-300">(Already present in the case)</span>}
                  </div>
                  <div className="text-xs mt-1 dark:text-slate-300">{activeItem.reasoning}</div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {currentChat.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {waitingForSuggestion && (
                    <div className="flex justify-center pt-2">
                      <ThinkingAnimation />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick actions for already-present items */}
                {activeItem.alreadyPresent && activeItem.status === "pending" && (
                  <div className="px-4 py-2 border-t bg-blue-50 dark:bg-blue-950/30 space-y-2 text-sm">
                    <div className="font-medium text-blue-800 dark:text-blue-300">AI-suggested value:</div>
                    <pre className="whitespace-pre-wrap text-xs bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-700 rounded p-2 max-h-32 overflow-y-auto text-slate-900 dark:text-slate-100">
                      {activeItem.existingValue || "(empty)"}
                    </pre>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleConfirmPresent}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setInputText(activeItem.existingValue || "")}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleSkip}>
                        Skip
                      </Button>
                    </div>
                  </div>
                )}

                {/* AI Suggestion Display */}
                {showingSuggestion && suggestedValue && activeItem.status === "pending" && (
                  <div className="px-4 py-2 border-t bg-teal-950/40 dark:bg-teal-900/60 border-teal-600 space-y-2 text-sm">
                    <div className="font-medium text-teal-600 dark:text-teal-300">Here's the result:</div>
                    <pre className="whitespace-pre-wrap text-xs bg-gray-900 dark:bg-gray-950 border border-teal-500 text-teal-50 dark:text-teal-100 rounded p-2 max-h-40 overflow-y-auto">
                      {suggestedValue}
                    </pre>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white"
                        onClick={handleApproveSuggestion}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950"
                        onClick={handleEditSuggestion}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-teal-600 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900"
                        onClick={handleSkip}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input area */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2 shrink-0 bg-white dark:bg-slate-950">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type your response... (Shift+Enter for newline)"
                    disabled={
                      isSending ||
                      waitingForSuggestion ||
                      activeItem.status === "answered" ||
                      activeItem.status === "accepted" ||
                      activeItem.status === "skipped"
                    }
                    className="flex-1 min-h-20 max-h-32 p-3 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-vertical focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => sendMessage()}
                      disabled={isSending || waitingForSuggestion || !inputText.trim() || activeItem.status !== "pending" || showingSuggestion}
                      size="sm"
                    >
                      {isSending ? "..." : "Send"}
                    </Button>
                    <Button
                      onClick={() => {
                        setEditorText(inputText);
                        setIsEditorOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Expand
                    </Button>
                    {!showingSuggestion && activeItem.status === "pending" && !activeItem.alreadyPresent && (
                      <Button onClick={handleGetAISuggestion} variant="outline" size="sm" disabled={waitingForSuggestion || isSending}>
                        {waitingForSuggestion ? (
                          <div className="flex items-center gap-2">
                            <ThinkingAnimation small />
                          </div>
                        ) : (
                          "AI Suggestion"
                        )}
                      </Button>
                    )}
                    <Button onClick={handleSkip} variant="ghost" size="sm" disabled={activeItem.status !== "pending"}>
                      Skip
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">Select an item to verify</div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        {/* ── Expanded editor modal ── */}
        <Dialog open={isEditorOpen} onOpenChange={(v) => setIsEditorOpen(!!v)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit Response</DialogTitle>
              <DialogDescription>Open editor for longer responses. Save to keep locally or Save & Send to send to the AI.</DialogDescription>
            </DialogHeader>
            <div className="p-2">
              <textarea
                value={editorText}
                onChange={(e) => setEditorText(e.target.value)}
                className="w-full min-h-[240px] p-3 border rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 resize-vertical"
              />
            </div>
            <div className="p-3 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditorOpen(false);
                }}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setInputText(editorText);
                  setIsEditorOpen(false);
                }}
                size="sm"
              >
                Save
              </Button>
              <Button
                onClick={async () => {
                  // Send the editor content via existing sendMessage flow
                  await sendMessage(editorText);
                  setIsEditorOpen(false);
                }}
                size="sm"
              >
                Save & Send
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <div className="p-3 border-t flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground">
            {resolvedCount}/{actionableItems.length} items reviewed
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {allMandatoryResolved && <Button onClick={() => onComplete()}>Finish Verification</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
