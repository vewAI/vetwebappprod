"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const FONT_SIZE_STORAGE_KEY = "vewai-font-size";
const DEFAULT_FONT_SIZE = 100; // Percentage
const MIN_FONT_SIZE = 75;
const MAX_FONT_SIZE = 150;
const STEP = 10;

type FontSizeContextType = {
    fontSize: number;
    increaseFontSize: () => void;
    decreaseFontSize: () => void;
    resetFontSize: () => void;
};

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
    const [fontSize, setFontSize] = useState<number>(DEFAULT_FONT_SIZE);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const stored = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
        if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed)) {
                setFontSize(parsed);
                document.documentElement.style.setProperty("--user-font-size-base", `${parsed}%`);
            }
        }
        setIsReady(true);
    }, []);

    const updateFontSize = useCallback((nextSize: number) => {
        const clamped = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, nextSize));
        setFontSize(clamped);
        if (typeof window !== "undefined") {
            window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, clamped.toString());
            document.documentElement.style.setProperty("--user-font-size-base", `${clamped}%`);
        }
    }, []);

    const increaseFontSize = useCallback(() => {
        updateFontSize(fontSize + STEP);
    }, [fontSize, updateFontSize]);

    const decreaseFontSize = useCallback(() => {
        updateFontSize(fontSize - STEP);
    }, [fontSize, updateFontSize]);

    const resetFontSize = useCallback(() => {
        updateFontSize(DEFAULT_FONT_SIZE);
    }, [updateFontSize]);

    return (
        <FontSizeContext.Provider value={{ fontSize, increaseFontSize, decreaseFontSize, resetFontSize }}>
            {children}
        </FontSizeContext.Provider>
    );
}

export function useFontSize() {
    const context = useContext(FontSizeContext);
    if (context === undefined) {
        throw new Error("useFontSize must be used within a FontSizeProvider");
    }
    return context;
}
