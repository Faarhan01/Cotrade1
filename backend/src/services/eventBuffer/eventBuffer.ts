import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'daemon-events.jsonl');

export interface StoredEvent {
  ts: number;
  type: string;
  payload: any;
}

// In-memory ring buffer for fast access and reduced disk churn
const memoryBuffer: StoredEvent[] = [];
const MAX_MEMORY_EVENTS = 500;
let flushTimer: NodeJS.Timeout | null = null;
let pendingDiskEvents: StoredEvent[] = [];

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function flushToDisk(): void {
  if (pendingDiskEvents.length === 0) return;
  try {
    ensureDataDir();
    const batch = pendingDiskEvents;
    pendingDiskEvents = [];
    const text = batch.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(EVENTS_FILE, text, 'utf-8');

    // Keep file size bounded (prune if > 1000 lines)
    if (fs.existsSync(EVENTS_FILE)) {
      const stats = fs.statSync(EVENTS_FILE);
      if (stats.size > 256 * 1024) { // > 256 KB
        const allLines = fs.readFileSync(EVENTS_FILE, 'utf-8').trim().split('\n');
        if (allLines.length > 500) {
          const trimmed = allLines.slice(-300).join('\n') + '\n';
          fs.writeFileSync(EVENTS_FILE, trimmed, 'utf-8');
        }
      }
    }
  } catch (error) {
    console.error('[EventBuffer] Failed to flush events to disk:', error);
  }
}

export function appendEvent(event: { type: string; payload: any }): void {
  try {
    const storedEvent: StoredEvent = {
      ts: Date.now(),
      type: event.type,
      payload: event.payload,
    };

    memoryBuffer.push(storedEvent);
    if (memoryBuffer.length > MAX_MEMORY_EVENTS) {
      memoryBuffer.shift();
    }

    pendingDiskEvents.push(storedEvent);

    if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushToDisk();
      }, 500);
    }
  } catch (error) {
    console.error('[EventBuffer] Failed to append event:', error);
  }
}

export function readEvents(options: {
  limit?: number;
  type?: string;
  startTime?: number;
  endTime?: number;
} = {}): StoredEvent[] {
  try {
    // Read from memory first for instant response
    let events = [...memoryBuffer];

    // If memory is empty but file exists, read recent entries
    if (events.length === 0 && fs.existsSync(EVENTS_FILE)) {
      const content = fs.readFileSync(EVENTS_FILE, 'utf-8');
      const lines = content.trim().split('\n').filter((l) => l.length > 0);
      events = lines
        .slice(-200)
        .map((l) => {
          try {
            return JSON.parse(l) as StoredEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is StoredEvent => e !== null);
    }

    // Apply filters
    if (options.type) {
      events = events.filter((e) => e.type === options.type);
    }
    if (options.startTime) {
      events = events.filter((e) => e.ts >= options.startTime!);
    }
    if (options.endTime) {
      events = events.filter((e) => e.ts <= options.endTime!);
    }

    events.sort((a, b) => a.ts - b.ts);

    if (options.limit !== undefined && options.limit > 0) {
      return events.slice(-options.limit);
    }

    return events;
  } catch (error) {
    console.error('[EventBuffer] Failed to read events:', error);
    return [];
  }
}

export function clearEvents(): void {
  try {
    memoryBuffer.length = 0;
    pendingDiskEvents.length = 0;
    ensureDataDir();
    fs.writeFileSync(EVENTS_FILE, '', 'utf-8');
  } catch (error) {
    console.error('[EventBuffer] Failed to clear events:', error);
  }
}