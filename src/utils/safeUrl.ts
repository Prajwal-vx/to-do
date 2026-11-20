export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeAttachmentDataUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^data:[^,]*,/i.test(trimmed) || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return null;
  }

  try {
    return new URL(trimmed).protocol === 'data:' ? trimmed : null;
  } catch {
    return null;
  }
}
