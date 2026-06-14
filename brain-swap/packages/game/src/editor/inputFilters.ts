const NAV_KEYS = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'Enter', 'Home', 'End'];

export function numericKeyDown(e: React.KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (NAV_KEYS.includes(e.key)) return;
  if (/^[0-9.\-]$/.test(e.key)) return;
  e.preventDefault();
}

export function numericPaste(e: React.ClipboardEvent) {
  const pasted = e.clipboardData.getData('text');
  if (!/^-?\d*\.?\d*$/.test(pasted)) e.preventDefault();
}