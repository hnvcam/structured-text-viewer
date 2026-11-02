import { rpc } from '../rpcClient';

// Copy text to the system clipboard. The bun process is the reliable path
// (the views:// origin may not be a secure context for navigator.clipboard),
// with browser APIs as fallbacks.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (await rpc.request.copyToClipboard({ text })) return true;
  } catch {
    // fall through to browser APIs
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
