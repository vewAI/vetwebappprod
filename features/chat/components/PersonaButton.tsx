"use client";

import React, { memo, useState } from "react";

export type PersonaButtonProps = {
  /** The role key (for data attributes) */
  roleKey: "owner" | "veterinary-nurse";
  /** Display label for the button */
  label: string;
  /** Portrait image URL (optional) */
  portraitUrl?: string;
  /** Fallback text when no portrait (e.g., "OWN", "NUR") */
  fallbackText: string;
  /** Whether this persona is currently active */
  isActive: boolean;
  /** Click handler */
  onClick: () => void;
  /** Optional test ID */
  testId?: string;
  /** Grid alignment: "end" for left items, "start" for right items */
  align?: "start" | "end";
};

/**
 * Memoized persona button with portrait.
 *
 * Prevents unnecessary re-renders when portrait URL hasn't changed.
 * Uses loading state to handle image load delays.
 */
export const PersonaButton = memo(function PersonaButton({
  roleKey,
  label,
  portraitUrl,
  fallbackText,
  isActive,
  onClick,
  testId,
  align = "end",
}: PersonaButtonProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset load state when URL changes
  React.useEffect(() => {
    if (portraitUrl) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [portraitUrl]);

  const showImage = portraitUrl && !imageError;
  const sizeClasses = isActive ? "h-20 w-20" : "h-10 w-10";
  const alignClass = align === "start" ? "sm:justify-self-start" : "sm:justify-self-end";

  return (
    <div className={`flex flex-col items-center gap-1 flex-shrink-0 justify-self-center ${alignClass}`}>
      {/* Portrait button */}
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isActive}
        className={`rounded-full overflow-hidden border bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform ${sizeClasses}`}
        aria-label={`Select ${label} persona`}
        data-persona={roleKey}
      >
        {showImage ? (
          <>
            {/* Show placeholder while loading */}
            {!imageLoaded && (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground animate-pulse bg-muted">
                {fallbackText}
              </div>
            )}
            <img
              src={portraitUrl}
              alt={`${label} portrait`}
              className={`h-full w-full object-cover ${imageLoaded ? "" : "hidden"}`}
              loading="eager"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">{fallbackText}</div>
        )}
      </button>

      {/* Label button */}
      <button
        type="button"
        onClick={onClick}
        className={`px-2 py-0.5 text-sm rounded-md ${isActive ? "bg-blue-600 text-white" : "bg-muted"}`}
        aria-pressed={isActive}
        data-testid={testId}
      >
        {label}
      </button>
    </div>
  );
});

export default PersonaButton;
