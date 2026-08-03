"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input via the browser-native Web Speech API (SpeechRecognition).
 * Zero-cost, zero-infra — no API keys, no server round-trip. Support is
 * Chrome/Edge-only today (Safari/Firefox lack SpeechRecognition); callers
 * must check `isSupported` and hide/disable the mic button when false
 * rather than showing a control that silently does nothing.
 */

// Minimal ambient typing — the Web Speech API has no official TS lib.
interface SpeechRecognitionResultLike {
  results: {
    length: number;
    [index: number]: { [index: number]: { transcript: string }; isFinal: boolean };
  };
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionResult {
  isSupported: boolean;
  isListening: boolean;
  /** Starts listening. Calls `onTranscript` with the final transcript once speech ends. */
  start: (onTranscript: (text: string) => void) => void;
  stop: () => void;
  error: string | null;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isSupported = getRecognitionConstructor() !== null;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback((onTranscript: (text: string) => void) => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor) {
      setError("Voice input isn't supported in this browser.");
      return;
    }

    setError(null);
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript ?? "";
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "Microphone access denied." : `Voice input error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isSupported, isListening, start, stop, error };
}
