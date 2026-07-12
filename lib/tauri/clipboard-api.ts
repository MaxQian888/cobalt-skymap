import { isDesktop, isTauri } from '@/lib/storage/platform';
import type { Image } from '@tauri-apps/api/image';

// The clipboard-manager plugin is only registered in the desktop Rust build.
function isDesktopTauri(): boolean {
  return isTauri() && isDesktop();
}

export interface TauriClipboardImageData {
  rgba: Uint8Array;
  width: number;
  height: number;
}

export type TauriClipboardImageInput = string | Image | Uint8Array | ArrayBuffer | number[];

async function getClipboardPlugin() {
  if (!isDesktopTauri()) {
    throw new Error('Tauri clipboard API is only available in desktop environment');
  }
  return import('@tauri-apps/plugin-clipboard-manager');
}

export const clipboardApi = {
  isAvailable(): boolean {
    return isDesktopTauri();
  },

  async writeText(text: string): Promise<void> {
    const plugin = await getClipboardPlugin();
    await plugin.writeText(text);
  },

  async readText(): Promise<string> {
    const plugin = await getClipboardPlugin();
    return plugin.readText();
  },

  async writeHtml(html: string, altText?: string): Promise<void> {
    const plugin = await getClipboardPlugin();
    await plugin.writeHtml(html, altText);
  },

  async writeImage(image: TauriClipboardImageInput): Promise<void> {
    const plugin = await getClipboardPlugin();
    await plugin.writeImage(image);
  },

  async readImage(): Promise<TauriClipboardImageData> {
    const plugin = await getClipboardPlugin();
    const image = await plugin.readImage();
    const [rgba, size] = await Promise.all([image.rgba(), image.size()]);
    return {
      rgba,
      width: size.width,
      height: size.height,
    };
  },

  async clear(): Promise<void> {
    const plugin = await getClipboardPlugin();
    await plugin.clear();
  },
};
