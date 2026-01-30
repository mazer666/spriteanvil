export function isInputFocused(): boolean {
  const active = document.activeElement;
  return (
    active?.tagName === "INPUT" ||
    active?.tagName === "TEXTAREA" ||
    (active?.hasAttribute("contenteditable") ?? false)
  );
}
