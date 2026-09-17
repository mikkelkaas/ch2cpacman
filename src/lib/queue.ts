import type { Capture, NewRecord } from './types';

export type QueuedCapture = NewRecord<Capture>;

const KEY = 'ch2cpacman.captureQueue';

function read(): QueuedCapture[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedCapture[]) : [];
  } catch {
    return [];
  }
}

function write(queue: QueuedCapture[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Storage full or blocked: the in-memory attempt below still runs.
  }
}

/** Captures waiting to be uploaded, oldest first. */
export function pending(): QueuedCapture[] {
  return read();
}

export function enqueue(capture: QueuedCapture): void {
  const queue = read();
  if (queue.some(c => c.clientId === capture.clientId)) return;
  queue.push(capture);
  write(queue);
}

/**
 * Upload in order and stop at the first failure, so a dead spot leaves the
 * queue intact and ordered for the next attempt.
 */
export async function drain(post: (capture: QueuedCapture) => Promise<unknown>): Promise<{ sent: number; left: number }> {
  let queue = read();
  let sent = 0;
  for (const capture of [...queue]) {
    try {
      await post(capture);
    } catch {
      break;
    }
    sent += 1;
    queue = queue.filter(c => c.clientId !== capture.clientId);
    write(queue);
  }
  return { sent, left: queue.length };
}
