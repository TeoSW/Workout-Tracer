/** 'cancelled' means the user closed the share sheet, so nothing was saved. */
export type SaveResult = 'saved' | 'cancelled';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Saves through the iOS share sheet when it takes files, otherwise as a download. A share sheet
 * that fails throws, because a download can't be confirmed and must not pass for a saved backup.
 */
export async function saveFile(name: string, text: string, type: string): Promise<SaveResult> {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw new Error('The share sheet could not open. Try again.');
    }
  }
  download(file);
  return 'saved';
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsText(file);
  });
}

/** False when the browser has no clipboard access, so the user can select the text instead. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
