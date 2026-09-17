import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drain, enqueue, pending } from './queue';
import type { QueuedCapture } from './queue';

function qc(clientId: string): QueuedCapture {
  return { teamId: 't1', pelletId: 'p1', capturedAt: '2026-09-20T10:00:00.000Z', lat: 0, lng: 0, clientId };
}

beforeEach(() => localStorage.clear());

describe('capture queue', () => {
  it('starts empty and keeps what is enqueued', () => {
    expect(pending()).toEqual([]);
    enqueue(qc('a'));
    enqueue(qc('b'));
    expect(pending().map(c => c.clientId)).toEqual(['a', 'b']);
  });
  it('does not enqueue the same clientId twice', () => {
    enqueue(qc('a'));
    enqueue(qc('a'));
    expect(pending()).toHaveLength(1);
  });
  it('keeps a capture enqueued while another was uploading', async () => {
    enqueue(qc('a'));
    const post = vi.fn(async (c: QueuedCapture) => {
      // A second pellet is eaten mid-upload.
      if (c.clientId === 'a') enqueue(qc('b'));
    });
    const result = await drain(post);
    expect(result).toEqual({ sent: 1, left: 1 });
    expect(pending().map(c => c.clientId)).toEqual(['b']);
  });

  it('removes sent captures and keeps failed ones, stopping at the first failure', async () => {
    enqueue(qc('a'));
    enqueue(qc('b'));
    enqueue(qc('c'));
    const post = vi.fn(async (c: QueuedCapture) => {
      if (c.clientId === 'b') throw new Error('offline');
    });
    const result = await drain(post);
    expect(result).toEqual({ sent: 1, left: 2 });
    expect(pending().map(c => c.clientId)).toEqual(['b', 'c']);
    expect(post).toHaveBeenCalledTimes(2);
  });
});
