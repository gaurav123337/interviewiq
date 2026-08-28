/* Simple undo stack for bulk admin operations.
   Records operations so Ctrl+Z can reverse them. */

export interface UndoEntry {
  label: string;
  undo: () => Promise<void>;
}

const stack: UndoEntry[] = [];
let onChange: (() => void) | null = null;

export function onUndoChange(cb: () => void) { onChange = cb; return () => { onChange = null; }; }

export function pushUndo(entry: UndoEntry) {
  stack.push(entry);
  if (stack.length > 20) stack.shift(); // keep max 20
  onChange?.();
}

export async function popUndo(): Promise<boolean> {
  const entry = stack.pop();
  if (!entry) return false;
  try {
    await entry.undo();
    onChange?.();
    return true;
  } catch {
    return false;
  }
}

export function peekUndo(): UndoEntry | null {
  return stack[stack.length - 1] ?? null;
}

export function getUndoHistory(): UndoEntry[] {
  return [...stack];
}

export function clearUndo() {
  stack.length = 0;
  onChange?.();
}
