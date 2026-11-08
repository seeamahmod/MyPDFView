import { Platform, PermissionsAndroid } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type DevicePdf = { id: string; uri: string; path: string; name: string; size: number; modified: number };

type Native = {
  hasAccess(): boolean;
  needsLegacyPermission(): boolean;
  openAccessSettings(): void;
  scan(): Promise<DevicePdf[]>;
  overwrite(path: string, sourceUri: string): Promise<number>;
  rename(path: string, newName: string): Promise<string>;
  delete(path: string): Promise<boolean>;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('DevicePdfs') : null;

export const devicePdfsAvailable = !!native;

export function hasDeviceAccess(): boolean {
  return native?.hasAccess() ?? false;
}

/** Android 11+: opens the "All files access" switch. Android 10 and below: runtime permission. */
export async function requestDeviceAccess(): Promise<boolean> {
  if (!native) return false;
  if (native.needsLegacyPermission()) {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }
  native.openAccessSettings();
  return false; // result is known when the app returns to the foreground
}

export const scanDevicePdfs = (): Promise<DevicePdf[]> => native?.scan() ?? Promise.resolve([]);
export const overwriteDeviceFile = (path: string, sourceUri: string) => native!.overwrite(path, sourceUri);
export const renameDeviceFile = (path: string, newName: string) => native!.rename(path, newName);
export const deleteDeviceFile = (path: string) => native!.delete(path);
