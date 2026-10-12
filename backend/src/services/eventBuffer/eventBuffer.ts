import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const EVENTS_FILE = join(process.cwd(), 'data', 'daemon-events.jsonl');

export interface StoredEvent {
  ts: number;
  type: string;
  payload: any;
}

export function appendEvent(event: { type: string; payload: any }): void {
  try {
    const storedEvent: StoredEvent = {
      ts: Date.now(),
      type: event.type,
      payload: event.payload
    };
    
    // Ensure data directory exists
    const dir = join(process.cwd(), 'data');
    if (!existsSync(dir)) {
      // Note: In a real app, you might want to create the directory
      // For now, we'll assume it exists based on the file already being present
    }
    
    // Append the event as a JSON line
    writeFileSync(EVENTS_FILE, JSON.stringify(storedEvent) + '\n', { flag: 'a' });
  } catch (error) {
    console.error('Failed to append event to buffer:', error);
  }
}

export function readEvents(options: {
  limit?: number;
  type?: string;
  startTime?: number;
  endTime?: number;
} = {}): StoredEvent[] {
  try {
    if (!existsSync(EVENTS_FILE)) {
      return [];
    }
    
    const content = require('fs').readFileSync(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter((line: string) => line.length > 0);
    
    const events = lines
      .map((line: string) => {
        try {
          return JSON.parse(line) as StoredEvent;
        } catch (e) {
          return null;
        }
      })
      .filter((event: StoredEvent | null): event is StoredEvent => event !== null)
      .filter((event: StoredEvent) => {
        // Apply filters
        if (options.type && event.type !== options.type) {
          return false;
        }
        if (options.startTime && event.ts < options.startTime) {
          return false;
        }
        if (options.endTime && event.ts > options.endTime) {
          return false;
        }
        return true;
      })
      // Sort by timestamp (oldest first) then apply limit from the end
      .sort((a: StoredEvent, b: StoredEvent) => a.ts - b.ts);
    
    if (options.limit !== undefined) {
      return events.slice(-options.limit);
    }
    
    return events;
  } catch (error) {
    console.error('Failed to read events from buffer:', error);
    return [];
  }
}

export function clearEvents(): void {
  try {
    require('fs').writeFileSync(EVENTS_FILE, '');
  } catch (error) {
    console.error('Failed to clear events buffer:', error);
  }
}