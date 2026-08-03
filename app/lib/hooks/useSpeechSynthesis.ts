"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Voice output via the browser-native SpeechSynthesis API. Same rationale
 * as useSpeechRecognition: zero cost, zero infra, no API keys. Support is
 * broad (Chrome/Edge/Safari/Firefox all implement SpeechSynthesis, unlike
 * SpeechRecognition), but still feature-detected for safety.
 */
export interface UseSpeechSynthesisResult {
  isSupported: boolean;
  isSpeaking: boolean;
  speak: (text: string) => void;
  stop: () => void;
}

/** Strips citation/markdown noise so read-aloud doesn't speak raw markup or [SOURCE: ...] tags verbatim. */
function toSpeechText(text: string): string {
  return text
    .replace(/\[SOURCE:[^\]]+\]/g, "")
    .replace(/⚠️ AI ANALYSIS[^\n]*/g, "AI analysis, requires council review.")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

export function useSpeechSynthesis(): UseSpeechSynthesisResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;
      window.speechSynthesis.cancel(); // don't overlap with a prior utterance
      const utterance = new SpeechSynthesisUtterance(toSpeechText(text));
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { isSupported, isSpeaking, speak, stop };
}
