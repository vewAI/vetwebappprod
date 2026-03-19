"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { caseVerificationService } from "../services/caseVerificationService";
import type {
  CaseVerificationItem,
  CaseVerificationResult,
  VerificationChatMessage,
} from "../models/caseVerification";

/* ── Relevance → visual style mapping ── */
const RELEVANCE_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  mandatory:   { dot: "bg-red-500",    label: "Mandatory", bg: "bg-red-50 border-red-200" },
  recommended: { dot: "bg-orange-400", label: "Recommended", bg: "bg-orange-50 border-orange-200" },
  optional:    { dot: "bg-yellow-400", label: "Optional",    bg: "bg-yellow-50 border-yellow-200" },
  unnecessary: { dot: "bg-gray-300",   label: "Unnecessary", bg: "bg-gray-50 border-gray-200" },
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
  onFieldResolved: (
    targetField: string,
    value: string,
    writeMode: "append" | "replace"
  ) => void;
  onComplete: () => void;
}

export function VerificationChatbot({
  open,
  onClose,
  verificationResult,
  caseContext,
  onFieldResolved,
  onComplete,
}: VerificationChatbotProps) {
  const [items, setItems] = useState<CaseVerificationItem[]>(
    verificationResult.items
  );
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [chatHistories, setChatHistories] = useState<
    Record<string, VerificationChatMessage[]>
  >({});
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showingSuggestion, setShowingSuggestion] = useState(false);
  const [suggestedValue, setSuggestedValue] = useState("");
  const [waitingForSuggestion, setWaitingForSuggestion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeItem: CaseVerificationItem | undefined = items[activeItemIndex];
  const activeItemId = activeItem?.id ?? "";

  const currentChat = chatHistories[activeItemId] ?? [];

  // Count resolved items (only non-unnecessary)
  const actionableItems = useMemo(
    () => items.filter((i) => i.relevance !== "unnecessary"),
    [items]
  );
  const resolvedCount = useMemo(
    () =>
      actionableItems.filter(
        (i) => i.status === "accepted" || i.status === "answered" || i.status === "skipped"
      ).length,
    [actionableItems]
  );
  const allResolved = resolvedCount >= actionableItems.length && actionableItems.length > 0;

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChat.length]);

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

  const sendMessage = useCallback(async () => {
    if (!inputText.trim() || !activeItem || isSending) return;
    const userText = inputText.trim();
    setInputText("");
    setIsSending(true);

    const userMsg: VerificationChatMessage = {
      id: `user-${Date.now()}`,
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
        response.reply.toLowerCase().includes("here's the result") ||
        response.reply.toLowerCase().includes("final answer") ||
        response.isResolved;

      const assistantMsg: VerificationChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        verificationItemId: activeItem.id,
        timestamp: new Date().toISOString(),
      };

      setChatHistories((prev) => ({
        ...prev,
        [activeItem.id]: [...(prev[activeItem.id] ?? []), userMsg, assistantMsg].filter(
          (msg, idx, arr) => arr.findIndex((m) => m.id === msg.id) === idx
        ),
      }));

      if (isResult && response.extractedValue) {
        setSuggestedValue(response.extractedValue);
        setShowingSuggestion(true);
      } else if (response.isResolved) {
        // Write value into form
        if (response.extractedValue) {
          onFieldResolved(
            response.targetField,
            response.extractedValue,
            response.writeMode
          );
        }

        // Update item status
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === activeItemIndex
              ? {
                  ...item,
                  status: response.extractedValue ? "answered" : "skipped",
                  professorAnswer: response.extractedValue ?? "",
                }
              : item
          )
        );

        // Auto-advance to next pending item after delay
        setTimeout(() => {
          const nextIdx = items.findIndex(
            (item, idx) =>
              idx > activeItemIndex &&
              item.status === "pending" &&
              item.relevance !== "unnecessary"
          );
          if (nextIdx !== -1) {
            setActiveItemIndex(nextIdx);
            setShowingSuggestion(false);
            setSuggestedValue("");
          }
        }, 800);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Connection error";
      const errorAssistantMsg: VerificationChatMessage = {
        id: `error-${Date.now()}`,
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
  }, [
    inputText,
    activeItem,
    activeItemIndex,
    isSending,
    chatHistories,
    caseContext,
    items,
    onFieldResolved,
  ]);

  const handleSkip = useCallback(() => {
    if (!activeItem) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeItemIndex ? { ...item, status: "skipped" } : item
      )
    );
    // Advance to next pending
    const nextIdx = items.findIndex(
      (item, idx) =>
        idx > activeItemIndex &&
        item.status === "pending" &&
        item.relevance !== "unnecessary"
    );
    if (nextIdx !== -1) {
      setActiveItemIndex(nextIdx);
      setShowingSuggestion(false);
      setSuggestedValue("");
    }
  }, [activeItem, activeItemIndex, items]);

  const handleConfirmPresent = useCallback(() => {
    if (!activeItem) return;
    // Write the existing value into the form when the professor confirms
    if (activeItem.existingValue) {
      onFieldResolved(activeItem.targetField, activeItem.existingValue, "append");
    }
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeItemIndex ? { ...item, status: "accepted" } : item
      )
    );
    const nextIdx = items.findIndex(
      (item, idx) =>
        idx > activeItemIndex &&
        item.status === "pending" &&
        item.relevance !== "unnecessary"
    );
    if (nextIdx !== -1) {
      setActiveItemIndex(nextIdx);
      setShowingSuggestion(false);
      setSuggestedValue("");
    }
  }, [activeItem, activeItemIndex, items, onFieldResolved]);

  const handleGetAISuggestion = useCallback(async () => {
    if (!activeItem) return;
    setWaitingForSuggestion(true);

    const userMsg: VerificationChatMessage = {
      id: `user-suggestion-${Date.now()}`,
      role: "user",
      content: "Can you suggest what data should be provided for this field?",
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
        id: `assistant-${Date.now()}`,
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
        id: `error-${Date.now()}`,
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

    onFieldResolved(activeItem.targetField, suggestedValue, "append");

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeItemIndex
          ? { ...item, status: "answered", professorAnswer: suggestedValue }
          : item
      )
    );

    // Auto-advance to next pending item
    setTimeout(() => {
      const nextIdx = items.findIndex(
        (item, idx) =>
          idx > activeItemIndex &&
          item.status === "pending" &&
          item.relevance !== "unnecessary"
      );
      if (nextIdx !== -1) {
        setActiveItemIndex(nextIdx);
        setShowingSuggestion(false);
        setSuggestedValue("");
      }
    }, 800);
  }, [activeItem, suggestedValue, activeItemIndex, items, onFieldResolved]);

  const handleEditSuggestion = useCallback(() => {
    if (!suggestedValue) return;
    setShowingSuggestion(false);
    setInputText(suggestedValue);
  }, [suggestedValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
        {/* ── Header ── */}
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>Case Verification</DialogTitle>
          <DialogDescription>
            {verificationResult.overallAssessment}
          </DialogDescription>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="font-medium">
              Completeness: {verificationResult.completenessScore}%
            </span>
            <span className="text-muted-foreground">
              {resolvedCount}/{actionableItems.length} items reviewed
            </span>
            {allResolved && (
              <span className="text-emerald-600 font-medium">
                ✓ Verification complete
              </span>
            )}
          </div>
        </DialogHeader>

        {/* ── Body: sidebar + chat ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar: item list ── */}
          <div className="w-72 border-r overflow-y-auto shrink-0 bg-muted/30">
            {(["mandatory", "recommended", "optional", "unnecessary"] as const).map(
              (relevance) => {
                const group = items.filter((i) => i.relevance === relevance);
                if (group.length === 0) return null;
                const style = RELEVANCE_STYLES[relevance];
                return (
                  <div key={relevance} className="py-2">
                    <div className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
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
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors ${
                            isActive ? "bg-accent font-medium" : ""
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
                          {item.alreadyPresent && item.status === "pending" && (
                            <span className="ml-auto text-xs text-blue-500 shrink-0">
                              ✎
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              }
            )}
          </div>

          {/* ── Chat panel ── */}
          <div className="flex-1 flex flex-col">
            {activeItem ? (
              <>
                {/* Item header */}
                <div
                  className={`p-3 border-b text-sm ${
                    RELEVANCE_STYLES[activeItem.relevance]?.bg ?? ""
                  }`}
                >
                  <div className="font-medium">{activeItem.itemName}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {activeItem.category} · {activeItem.relevance} ·{" "}
                    Frequency: {activeItem.expectedFrequency}
                    {activeItem.alreadyPresent && (
                      <span className="ml-2 text-blue-600">
                        (Already present in the case)
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-1">{activeItem.reasoning}</div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {currentChat.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick actions for already-present items */}
                {activeItem.alreadyPresent && activeItem.status === "pending" && (
                  <div className="px-4 py-2 border-t bg-blue-50 space-y-2 text-sm">
                    <div className="font-medium text-blue-800">AI-suggested value:</div>
                    <pre className="whitespace-pre-wrap text-xs bg-white border border-blue-200 rounded p-2 max-h-32 overflow-y-auto">
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
                  <div className="px-4 py-2 border-t bg-emerald-50 space-y-2 text-sm">
                    <div className="font-medium text-emerald-800">Here's the result:</div>
                    <pre className="whitespace-pre-wrap text-xs bg-white border border-emerald-200 rounded p-2 max-h-40 overflow-y-auto">
                      {suggestedValue}
                    </pre>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApproveSuggestion}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleEditSuggestion}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleSkip}>
                        Skip
                      </Button>
                    </div>
                  </div>
                )}

                {/* Input area */}
                <div className="p-3 border-t flex items-center gap-2 shrink-0">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response..."
                    disabled={
                      isSending ||
                      waitingForSuggestion ||
                      activeItem.status === "answered" ||
                      activeItem.status === "accepted" ||
                      activeItem.status === "skipped"
                    }
                    className="flex-1"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={
                      isSending ||
                      waitingForSuggestion ||
                      !inputText.trim() ||
                      activeItem.status !== "pending" ||
                      showingSuggestion
                    }
                    size="sm"
                  >
                    {isSending ? "..." : "Send"}
                  </Button>
                  {!showingSuggestion && activeItem.status === "pending" && !activeItem.alreadyPresent && (
                    <Button
                      onClick={handleGetAISuggestion}
                      variant="outline"
                      size="sm"
                      disabled={waitingForSuggestion || isSending}
                    >
                      {waitingForSuggestion ? "..." : "AI Suggestion"}
                    </Button>
                  )}
                  <Button
                    onClick={handleSkip}
                    variant="ghost"
                    size="sm"
                    disabled={activeItem.status !== "pending"}
                  >
                    Skip
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select an item to verify
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="p-3 border-t flex items-center justify-between shrink-0">
          <div className="text-sm text-muted-foreground">
            {resolvedCount}/{actionableItems.length} items reviewed
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {allResolved && (
              <Button onClick={onComplete}>
                Finish Verification
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
