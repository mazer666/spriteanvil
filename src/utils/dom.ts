/**
 * src/utils/dom.ts
 * -----------------------------------------------------------------------------
 * ## DOM UTILS (Noob Guide)
 * 
 * This file is like a "Sensor". It checks what's happening on the 
 * physical webpage.
 * 
 * 1. FOCUS CHECK: It tells us if the user is currently typing in a 
 *    text box. If they are, we stop the keyboard shortcuts (like 'B') 
 *    so they don't accidentally switch tools while typing a project name.
 * 
 * ## VAR TRACE
 * - `active`: (Origin: window.document) The element the user is currently clicking/typing in.
 */
export function isInputFocused(): boolean {
  const active = document.activeElement;
  return (
    active?.tagName === "INPUT" ||
    active?.tagName === "TEXTAREA" ||
    (active?.hasAttribute("contenteditable") ?? false)
  );
}
