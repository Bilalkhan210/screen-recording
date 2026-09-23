import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';
import {
  RecordingOptions,
  RecordingStartResult,
  RecordingStopResult,
  GallerySaveResult,
} from '../types';

const { ScreenRecordModule } = NativeModules;

if (!ScreenRecordModule) {
  console.warn(
    'ScreenRecordModule is not linked. Make sure ScreenRecordPackage is added to MainApplication.kt.'
  );
}

export class ScreenRecorderService {
  /**
   * Starts screen recording session.
   * Prompts user with Android MediaProjection system consent popup.
   */
  static async startRecording(options?: RecordingOptions): Promise<RecordingStartResult> {
    if (!ScreenRecordModule) {
      throw new Error('ScreenRecordModule native module is not available');
    }
    return await ScreenRecordModule.startRecording(options || {});
  }

  static async beginRecording(): Promise<RecordingStartResult> {
    if (!ScreenRecordModule) {
      throw new Error('ScreenRecordModule native module is not available');
    }
    return await ScreenRecordModule.beginRecording();
  }

  static async hasMicrophonePermission(): Promise<boolean> {
    if (!ScreenRecordModule) return false;
    return await ScreenRecordModule.hasMicrophonePermission();
  }

  /**
   * Stops screen recording session and returns recorded MP4 file details.
   */
  static async stopRecording(): Promise<RecordingStopResult> {
    if (!ScreenRecordModule) {
      throw new Error('ScreenRecordModule native module is not available');
    }
    return await ScreenRecordModule.stopRecording();
  }

  /**
   * Pauses the recording (Android 7.0+).
   */
  static async pauseRecording(): Promise<boolean> {
    if (!ScreenRecordModule) return false;
    return await ScreenRecordModule.pauseRecording();
  }

  /**
   * Resumes the paused recording.
   */
  static async resumeRecording(): Promise<boolean> {
    if (!ScreenRecordModule) return false;
    return await ScreenRecordModule.resumeRecording();
  }

  /**
   * Checks if recording is currently active.
   */
  static async isRecording(): Promise<boolean> {
    if (!ScreenRecordModule) return false;
    return await ScreenRecordModule.isRecording();
  }

  /**
   * Gets current recording duration in milliseconds.
   */
  static async getRecordingDuration(): Promise<number> {
    if (!ScreenRecordModule) return 0;
    return await ScreenRecordModule.getRecordingDuration();
  }

  /**
   * Saves the temporary video file to Android public MediaStore (Movies/ScreenRecordings).
   * Appears immediately in device Gallery and Google Photos.
   */
  static async saveToGallery(filePath: string): Promise<GallerySaveResult> {
    if (!ScreenRecordModule) {
      throw new Error('ScreenRecordModule native module is not available');
    }
    return await ScreenRecordModule.saveToGallery(filePath);
  }

  /**
   * Discards and deletes the temporary video file without saving to Gallery.
   */
  static async discardRecording(filePath: string): Promise<boolean> {
    if (!ScreenRecordModule) return true;
    return await ScreenRecordModule.discardRecording(filePath);
  }

  /**
   * Checks if "Display over other apps" permission is granted.
   */
  static async checkOverlayPermission(): Promise<boolean> {
    if (!ScreenRecordModule) return true;
    return await ScreenRecordModule.checkOverlayPermission();
  }

  /**
   * Opens Android Settings to request "Display over other apps" permission.
   */
  static async requestOverlayPermission(): Promise<boolean> {
    if (!ScreenRecordModule) return true;
    return await ScreenRecordModule.requestOverlayPermission();
  }

  /**
   * Subscribes to 1-second interval timer updates from the native foreground service.
   */
  static addTimerListener(
    listener: (data: { elapsedMillis: number; formattedTime: string }) => void
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener('onTick', listener);
  }

  /**
   * Subscribes to recording state changes (started, stopped, paused).
   */
  static addStateListener(
    listener: (data: { isRecording: boolean; isPaused: boolean }) => void
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener('onStateChanged', listener);
  }

  /**
   * Subscribes to recording stopped event.
   */
  static addStopListener(
    listener: (data: RecordingStopResult) => void
  ): EmitterSubscription {
    return DeviceEventEmitter.addListener('onRecordingStopped', listener);
  }

  static addOverlayStopListener(listener: () => void): EmitterSubscription {
    return DeviceEventEmitter.addListener('onOverlayStopRequested', listener);
  }

  static async consumeOverlayStopRequest(): Promise<boolean> {
    if (!ScreenRecordModule) return false;
    return await ScreenRecordModule.consumeOverlayStopRequest();
  }
}
