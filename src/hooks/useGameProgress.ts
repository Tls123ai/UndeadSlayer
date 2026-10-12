"use client";

import { useCallback, useRef, useState } from "react";
import { requestJson, errorMessage, RequestError } from "@/lib/clientApi";
import type { PlayerProgress } from "@/lib/progress";

export interface SaveStatus {
  state: "idle" | "saving" | "saved" | "error";
  message?: string;
  needsAuth?: boolean;
}

export default function useGameProgress() {
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });
  const current = useRef<PlayerProgress | null>(null);
  const status = useRef<SaveStatus>({ state: "idle" });
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const sequence = useRef(0);
  const generation = useRef(0);

  const updateStatus = useCallback((next: SaveStatus) => {
    status.current = next;
    setSaveStatus(next);
  }, []);

  const setSessionProgress = useCallback((next: PlayerProgress | null) => {
    generation.current += 1;
    sequence.current = 0;
    queue.current = Promise.resolve(true);
    current.current = next;
    setProgress(next);
    updateStatus({ state: next ? "saved" : "idle" });
  }, [updateStatus]);

  const saveProgress = useCallback((update: (previous: PlayerProgress) => PlayerProgress): Promise<boolean> => {
    if (!current.current) return Promise.resolve(false);
    const next = update(current.current);
    if (next === current.current) return Promise.resolve(true);
    current.current = next;
    setProgress(next);
    const id = ++sequence.current;
    const owner = generation.current;
    updateStatus({ state: "saving" });

    // Serialize writes: fast purchases/slider changes cannot arrive out of order.
    // A newer snapshot contains all earlier optimistic edits, even after a failure.
    const task = queue.current.then(async () => {
      if (owner !== generation.current) return false;
      try {
        const data = await requestJson<{ progress: PlayerProgress }>("/api/game/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!data.progress || data.progress.userId !== next.userId) throw new Error("The server could not confirm your save.");
        if (owner === generation.current && id === sequence.current) {
          current.current = data.progress;
          setProgress(data.progress);
          updateStatus({ state: "saved" });
        }
        return true;
      } catch (error) {
        if (owner === generation.current && id === sequence.current) {
          updateStatus({
            state: "error",
            message: errorMessage(error, "Your progress could not be saved. Please try again."),
            needsAuth: error instanceof RequestError && error.status === 401,
          });
        }
        return false;
      }
    });
    queue.current = task;
    return task;
  }, [updateStatus]);

  const retrySave = useCallback(() => saveProgress((previous) => ({ ...previous })), [saveProgress]);
  const flushSaves = useCallback(async () => {
    let pending: Promise<boolean>;
    do {
      pending = queue.current;
      await pending;
    } while (pending !== queue.current);
    return status.current.state === "saved" || status.current.state === "idle";
  }, []);

  return { progress, saveStatus, saveProgress, setSessionProgress, retrySave, flushSaves };
}
