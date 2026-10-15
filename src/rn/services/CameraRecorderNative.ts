import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';
import { CameraRecordingOptions, CameraRecordingStopResult } from '../types';

const { CameraRecordModule } = NativeModules;

if (!CameraRecordModule) {
  console.warn(
    'CameraRecordModule is not linked. Make sure CameraRecordModule is added to ScreenRecordPackage.kt.'
  );
}

export class CameraRecorderService {
  static async hasCameraPermission(): Promise<boolean> {
    if (!CameraRecordModule) return false;
    return await CameraRecordModule.hasCameraPermission();
  }

  static async startCameraRecording(
    options?: CameraRecordingOptions
  ): Promise<{ started: boolean; facing: string }> {
    if (!CameraRecordModule) {
      throw new Error('CameraRecordModule native module is not available');
    }
    return await CameraRecordModule.startCameraRecording(options || {});
  }

  static async stopCameraRecording(): Promise<CameraRecordingStopResult> {
    if (!CameraRecordModule) {
      throw new Error('CameraRecordModule native module is not available');
    }
    return await CameraRecordModule.stopCameraRecording();
  }

  static async pauseCameraRecording(): Promise<boolean> {
    if (!CameraRecordModule) return false;
    return await CameraRecordModule.pauseCameraRecording();
  }

  static async resumeCameraRecording(): Promise<boolean> {
    if (!CameraRecordModule) return false;
    return await CameraRecordModule.resumeCameraRecording();
  }

  static async isCameraRecording(): Promise<boolean> {
    if (!CameraRecordModule) return false;
    return await CameraRecordModule.isCameraRecording();
  }

  static async getCameraRecordingDuration(): Promise<number> {
    if (!CameraRecordModule) return 0;
    return await CameraRecordModule.getCameraRecordingDuration();
  }

  static addCameraTimerListener(
    listener: (data: { elapsedMillis: number; formattedTime: string }) => void
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener('onCameraTick', listener);
  }

  static addCameraStateListener(
    listener: (data: { isRecording: boolean; isPaused: boolean }) => void
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener('onCameraStateChanged', listener);
  }

  static addCameraStopListener(
    listener: (data: CameraRecordingStopResult) => void
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener('onCameraRecordingStopped', listener);
  }
}
