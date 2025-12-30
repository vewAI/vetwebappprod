"use client";

import React from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFontSize } from "../context/FontSizeContext";
import { cn } from "@/lib/utils";

export function FontSizeToggle({ className }: { className?: string }) {
    const { increaseFontSize, decreaseFontSize, resetFontSize } = useFontSize();

    return (
        <div className={cn("flex items-center gap-1", className)}>
            <Button
                variant="ghost"
                size="icon"
                onClick={decreaseFontSize}
                title="Decrease font size"
                className="size-8"
            >
                <ZoomOut className="size-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={resetFontSize}
                title="Reset font size"
                className="size-8"
            >
                <RotateCcw className="size-3" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={increaseFontSize}
                title="Increase font size"
                className="size-8"
            >
                <ZoomIn className="size-4" />
            </Button>
        </div>
    );
}
