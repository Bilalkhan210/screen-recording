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
    const permissionsToRequest: string[] = [];

    if (Platform.Version >= 33) {
      permissionsToRequest.push('android.permission.POST_NOTIFICATIONS');
    }
    if (recordAudio) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
    if (useCamera) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }
    if (Platform.Version < 29) {
      permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    }

    if (permissionsToRequest.length > 0) {
      await PermissionsAndroid.requestMultiple(permissionsToRequest as any);
    }

    const canRecordAudio = recordAudio
      ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
      : true;

    const canUseCamera = useCamera
      ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA)
      : true;

    const canNotify = Platform.Version >= 33
      ? await PermissionsAndroid.check('android.permission.POST_NOTIFICATIONS' as any)
      : true;

    const canWriteStorage = Platform.Version < 29
      ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE)
      : true;

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
