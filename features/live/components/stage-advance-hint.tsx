"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

type StageAdvanceHintProps = {
  visible: boolean;
};

export function StageAdvanceHint({ visible }: StageAdvanceHintProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShow(false);
      return;
    }

    // Show the hint
    setShow(true);

    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      setShow(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!show) return null;

  return (
    <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce pointer-events-none">
      {/* Arrow pointing down to the button */}
      <div className="flex flex-col items-center">
        <p className="text-[10px] font-medium text-yellow-400 whitespace-nowrap bg-yellow-400/10 px-2 py-0.5 rounded-full border border-yellow-400/30">
          Click here to advance stage
        </p>
        <ArrowUp className="h-5 w-5 text-yellow-400 animate-pulse" />
      </div>
    </div>
  );
}
