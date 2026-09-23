import type { Capture, GameEvent, NewRecord } from './types';

export type QueuedCapture = NewRecord<Capture>;
export type QueuedEvent = NewRecord<GameEvent>;

/**
 * A localStorage upload queue for append-only records identified by
 * `clientId`. Upload happens in order and stops at the first failure, so a
 * dead spot leaves the queue intact and ordered for the next attempt. One
 * drain at a time: a second call while one runs joins it, so two timers never
 * POST the same record at once.
 */
export function createQueue<T extends { clientId: string }>(key: string) {
  const read = (): T[] => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      return [];
    }
  };
  const write = (queue: T[]): void => {
    try {
      localStorage.setItem(key, JSON.stringify(queue));
    } catch {
      // Storage full or blocked: the in-memory attempt below still runs.
    }
  };
  let inFlight: Promise<{ sent: number; left: number }> | null = null;
  const run = async (post: (record: T) => Promise<unknown>): Promise<{ sent: number; left: number }> => {
    let sent = 0;
    for (const record of read()) {
      try {
        await post(record);
      } catch {
        break;
      }
      sent += 1;
      // Re-read before removing: a record enqueued while this one was in
      // flight must survive. Writing back a stale snapshot used to drop it.
      write(read().filter(r => r.clientId !== record.clientId));
    }
    return { sent, left: read().length };
  };
  return {
    /** Records waiting to be uploaded, oldest first. */
    pending: (): T[] => read(),
    enqueue(record: T): void {
      const queue = read();
      if (queue.some(r => r.clientId === record.clientId)) return;
      queue.push(record);
      write(queue);
    },
    drain(post: (record: T) => Promise<unknown>): Promise<{ sent: number; left: number }> {
      inFlight ??= run(post).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}

export const captureQueue = createQueue<QueuedCapture>('ch2cpacman.captureQueue');
export const eventQueue = createQueue<QueuedEvent>('ch2cpacman.eventQueue');

export const pending = captureQueue.pending;
export const enqueue = captureQueue.enqueue;
export const drain = captureQueue.drain;
