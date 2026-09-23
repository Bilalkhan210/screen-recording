import { PermissionsAndroid, Platform } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  canRecordAudio: boolean;
  canNotify: boolean;
  canWriteStorage: boolean;
  canUseCamera: boolean;
}

/**
 * Requests all required Android runtime permissions for Screen Recording.
 * Note: MediaProjection permission is handled via system activity dialog (ScreenRecordModule).
 */
export async function requestScreenRecordingPermissions(recordAudio: boolean = true, useCamera: boolean = false): Promise<PermissionResult> {
  if (Platform.OS !== 'android') {
    return { granted: true, canRecordAudio: true, canNotify: true, canWriteStorage: true, canUseCamera: true };
  }

  try {
    const ensurePermission = async (permission: string): Promise<boolean> => {
      const alreadyGranted = await PermissionsAndroid.check(permission as any);
      if (alreadyGranted) return true;

      await PermissionsAndroid.request(permission as any);
      return PermissionsAndroid.check(permission as any);
    };

    const canRecordAudio = recordAudio
      ? await ensurePermission(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
      : true;

    const canUseCamera = useCamera
      ? await ensurePermission(PermissionsAndroid.PERMISSIONS.CAMERA)
      : true;

    const canNotify = Platform.Version >= 33
      ? await ensurePermission('android.permission.POST_NOTIFICATIONS')
      : true;

    if (Platform.Version < 29) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    }

    return {
      granted: canNotify && (!recordAudio || canRecordAudio) && (!useCamera || canUseCamera),
      canRecordAudio,
      canNotify,
      canWriteStorage,
      canUseCamera,
    };
  } catch (error) {
    console.error('Error requesting Android permissions:', error);
    return {
      granted: false,
      canRecordAudio: false,
      canNotify: false,
      canWriteStorage: false,
      canUseCamera: false,
    };
  }
}
