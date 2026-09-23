export type VideoQuality = '1080p' | '720p' | '480p' | 'custom';

export interface RecordingOptions {
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  recordAudio?: boolean;
  audioSource?: 'mic' | 'internal' | 'none';
  countdownSeconds?: number;
}

export interface RecordingStartResult {
  started: boolean;
  width: number;
  height: number;
}

export interface RecordingStopResult {
  filePath: string;
  fileName: string;
  durationMillis: number;
  fileSize: number;
  width: number;
  height: number;
}

export interface GallerySaveResult {
  success: boolean;
  galleryUri: string;
  message: string;
}

export interface RecordedItem {
  id: string;
  filePath: string;
  fileName: string;
  date: string;
  durationFormatted: string;
  durationMillis: number;
  fileSizeBytes: number;
  resolution: string;
  savedToGallery: boolean;
  previewUrl?: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationMillis: number;
  formattedTime: string;
}
