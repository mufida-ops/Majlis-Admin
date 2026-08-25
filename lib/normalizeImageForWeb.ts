import { Platform } from 'react-native';

/**
 * On web, a picked photo can be a format browsers can't reliably decode for
 * display — HEIC especially, which iPhones save photos as by default, and
 * which expo-image-picker's web implementation hands back unconverted
 * (native picker output is already always-displayable, so this only
 * matters here). The upload itself "succeeds" either way — it's only the
 * later `<img>` render that silently fails, with a valid link pointing at
 * unusable bytes. Redrawing through a canvas forces a real decode, so an
 * unreadable file fails loudly right here instead, and re-exports as JPEG,
 * which every browser can always display.
 */
export async function normalizeImageForWeb(uri: string, mimeType: string): Promise<{ uri: string; mimeType: string }> {
  if (Platform.OS !== 'web') return { uri, mimeType };

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Some formats this browser can't actually decode still fire onload
      // instead of onerror, just with no real dimensions — without this
      // check that silently produces a 0x0 image, which uploads "fine" and
      // only fails later, when something tries to display it.
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error("Could not read that photo — it may be in a format this can't open. Try a different one."));
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not process that image.'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        blob => {
          if (!blob || blob.size === 0) {
            reject(new Error('Could not process that image.'));
            return;
          }
          resolve({ uri: URL.createObjectURL(blob), mimeType: 'image/jpeg' });
        },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => reject(new Error("Could not read that photo — it may be in a format this can't open. Try a different one."));
    img.src = uri;
  });
}
