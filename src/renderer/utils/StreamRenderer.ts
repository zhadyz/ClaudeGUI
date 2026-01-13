/**
 * Smooth streaming text renderer using RAF batching
 * Prevents layout thrashing by batching DOM updates to animation frames
 */
export class StreamRenderer {
  private buffer = '';
  private rafScheduled = false;
  private onUpdate: (text: string) => void;
  private onScroll?: () => void;

  constructor(onUpdate: (text: string) => void, onScroll?: () => void) {
    this.onUpdate = onUpdate;
    this.onScroll = onScroll;
  }

  /**
   * Append text chunk - will be batched and flushed on next animation frame
   */
  append(chunk: string): void {
    this.buffer += chunk;
    this.scheduleFlush();
  }

  /**
   * Schedule a RAF flush if not already scheduled
   */
  private scheduleFlush(): void {
    if (this.rafScheduled) return;

    this.rafScheduled = true;
    requestAnimationFrame(() => this.flush());
  }

  /**
   * Flush buffered content to the update callback
   */
  private flush(): void {
    if (this.buffer) {
      this.onUpdate(this.buffer);
      this.buffer = '';
    }

    // Auto-scroll in same RAF callback
    if (this.onScroll) {
      this.onScroll();
    }

    this.rafScheduled = false;
  }

  /**
   * Force flush any remaining content (call when stream ends)
   */
  forceFlush(): void {
    if (this.rafScheduled) {
      cancelAnimationFrame(this.rafScheduled as unknown as number);
    }
    this.flush();
  }

  /**
   * Clear the buffer without flushing
   */
  clear(): void {
    this.buffer = '';
  }
}

/**
 * Hook for using StreamRenderer in React components
 */
export function createStreamBuffer() {
  let buffer = '';
  let rafId: number | null = null;

  return {
    append: (chunk: string, callback: (accumulated: string) => void) => {
      buffer += chunk;

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          callback(buffer);
          buffer = '';
          rafId = null;
        });
      }
    },

    flush: (callback: (accumulated: string) => void) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (buffer) {
        callback(buffer);
        buffer = '';
      }
    },

    clear: () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      buffer = '';
    }
  };
}
