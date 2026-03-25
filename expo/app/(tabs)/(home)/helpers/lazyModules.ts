import { Platform } from 'react-native';

type RorkToolkitModule = typeof import('@rork-ai/toolkit-sdk');
type LegacyFileSystemModule = typeof import('expo-file-system/legacy');
type ExpoSharingModule = typeof import('expo-sharing');
type ExpoClipboardModule = typeof import('expo-clipboard');
type ExpoImageManipulatorModule = typeof import('expo-image-manipulator');

let rorkToolkitPromise: Promise<RorkToolkitModule | null> | null = null;
let legacyFsPromise: Promise<LegacyFileSystemModule | null> | null = null;
let sharingPromise: Promise<ExpoSharingModule | null> | null = null;
let clipboardPromise: Promise<ExpoClipboardModule | null> | null = null;
let imageManipulatorPromise: Promise<ExpoImageManipulatorModule | null> | null = null;

export async function getRorkToolkit(): Promise<RorkToolkitModule | null> {
  try {
    if (!rorkToolkitPromise) {
      rorkToolkitPromise = import('@rork-ai/toolkit-sdk')
        .then((m) => m as RorkToolkitModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load @rork-ai/toolkit-sdk', { message, platform: Platform.OS });
          return null;
        });
    }
    return await rorkToolkitPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getRorkToolkit unexpected error', { message, platform: Platform.OS });
    return null;
  }
}

export async function getLegacyFileSystem(): Promise<LegacyFileSystemModule | null> {
  try {
    if (!legacyFsPromise) {
      legacyFsPromise = import('expo-file-system/legacy')
        .then((m) => m as LegacyFileSystemModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-file-system/legacy', { message });
          return null;
        });
    }
    return await legacyFsPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getLegacyFileSystem unexpected error', { message });
    return null;
  }
}

export async function getExpoSharing(): Promise<ExpoSharingModule | null> {
  try {
    if (!sharingPromise) {
      sharingPromise = import('expo-sharing')
        .then((m) => m as ExpoSharingModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-sharing', { message });
          return null;
        });
    }
    return await sharingPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getExpoSharing unexpected error', { message });
    return null;
  }
}

export async function getExpoClipboard(): Promise<ExpoClipboardModule | null> {
  try {
    if (!clipboardPromise) {
      clipboardPromise = import('expo-clipboard')
        .then((m) => m as ExpoClipboardModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-clipboard', { message });
          return null;
        });
    }
    return await clipboardPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getExpoClipboard unexpected error', { message });
    return null;
  }
}

export async function getExpoImageManipulator(): Promise<ExpoImageManipulatorModule | null> {
  try {
    if (!imageManipulatorPromise) {
      imageManipulatorPromise = import('expo-image-manipulator')
        .then((m) => m as ExpoImageManipulatorModule)
        .catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          console.log('[Home] failed to load expo-image-manipulator', { message });
          return null;
        });
    }
    return await imageManipulatorPromise;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[Home] getExpoImageManipulator unexpected error', { message });
    return null;
  }
}
