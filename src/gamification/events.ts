// Tiny typed event emitter so DB/engine code stays UI-free: the engine awards,
// emits, and whoever is mounted (toast layer, Spark pill, companion) reacts.

import type { SparkAward } from '../types';

/** One engine call's worth of awards, batched for the UI. */
export interface SparkEvent {
  awards: SparkAward[];
  /** Total Sparks earned by this action (sum of award amounts). */
  total: number;
  leveledUp: boolean;
  level: number;
  lifetime: number;
  balance: number;
  /** Set when the action created a new assignment (drives the capture highlight). */
  capturedAssignmentId?: number;
}

type Listener<T> = (payload: T) => void;

const sparkListeners = new Set<Listener<SparkEvent>>();
const progressListeners = new Set<Listener<void>>();

export function onSpark(cb: Listener<SparkEvent>): () => void {
  sparkListeners.add(cb);
  return () => sparkListeners.delete(cb);
}

export function emitSpark(e: SparkEvent): void {
  for (const cb of sparkListeners) cb(e);
  emitProgressChanged();
}

/** Fired whenever the progress row changes (awards, spends, settles). */
export function onProgressChanged(cb: Listener<void>): () => void {
  progressListeners.add(cb);
  return () => progressListeners.delete(cb);
}

export function emitProgressChanged(): void {
  for (const cb of progressListeners) cb();
}
