import { InteractionManager, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * iOS: after the Photos/Camera permission sheet dismisses, presenting PHPicker in the same
 * turn often yields `canceled` or an empty asset — user has to pick again. Defer the picker
 * until the next frame + a short delay after a fresh authorization.
 */
const IOS_POST_AUTH_DELAY_MS = 480;

function delayAfterInteractions(ms: number): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, ms);
    });
  });
}

export async function prepareMediaLibraryPicker(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing.status === 'granted') return true;

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (requested.status !== 'granted') return false;

  if (Platform.OS === 'ios' && existing.status !== 'granted') {
    await delayAfterInteractions(IOS_POST_AUTH_DELAY_MS);
  }
  return true;
}

export async function prepareCameraPicker(): Promise<boolean> {
  if (Platform.OS === 'web') return true;

  const existing = await ImagePicker.getCameraPermissionsAsync();
  if (existing.status === 'granted') return true;

  const requested = await ImagePicker.requestCameraPermissionsAsync();
  if (requested.status !== 'granted') return false;

  if (Platform.OS === 'ios' && existing.status !== 'granted') {
    await delayAfterInteractions(IOS_POST_AUTH_DELAY_MS);
  }
  return true;
}

/** Prefer no in-picker crop on iOS (extra step + flaky first pick). */
export function pickerAllowsEditing(): boolean {
  return Platform.OS !== 'ios';
}
