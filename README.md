# Screen Recorder - Production-Ready React Native CLI Android Application

A complete, production-grade React Native CLI Android Screen Recording application powered by modern Android MediaProjection API, Foreground Service (`FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION`), and Android MediaStore Scoped Storage.

---

## 📱 Features & Highlights

- **React Native CLI (Pure Native, NOT Expo)**: Native Android Kotlin modules bridging to React Native JavaScript/TypeScript.
- **Android 14/15+ MediaProjection Compliant**:
  - Implements `MediaProjectionManager.createScreenCaptureIntent()` for system user consent.
  - Requires and declares `FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION`.
  - Ongoing persistent Android notification with duration timer, Pause/Resume, and direct **Stop Recording** action.
- **Hardware-Accelerated Video Pipeline**:
  - `MediaRecorder` + `VirtualDisplay` pipeline capturing H.264 (AVC) MP4 video and AAC audio at 1080p/720p 60FPS.
- **MediaStore Public Gallery Export**:
  - Saves completed recordings into `MediaStore.Video.Media` (`Movies/ScreenRecordings`).
  - Videos immediately appear in Google Photos and Samsung Gallery.
  - Discard/Cancel option cleans up temporary cache files safely.
- **Safe Android Back Button Handling**:
  - Prevents accidental exit during active recordings.
  - Allows app to be minimized while recording continues smoothly in the background.

---

## 📂 Project Structure

```
├── android/
│   ├── app/
│   │   ├── build.gradle
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── res/values/strings.xml
│   │       ├── res/values/styles.xml
│   │       ├── res/drawable/ic_notification.xml
│   │       └── java/com/screenrecorder/
│   │           ├── MainActivity.kt
│   │           ├── MainApplication.kt
│   │           └── recording/
│   │               ├── ScreenRecordModule.kt       # React Native NativeModule bridge
│   │               ├── ScreenRecordService.kt      # MediaProjection Foreground Service
│   │               ├── ScreenRecordPackage.kt      # ReactPackage registration
│   │               └── MediaStoreHelper.kt         # Android MediaStore & Scoped Storage
│   ├── build.gradle
│   ├── settings.gradle
│   └── gradle.properties
├── src/
│   ├── rn/
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx                  # Home screen with timer & record controls
│   │   │   ├── RecordingsScreen.tsx            # Saved gallery recordings
│   │   │   └── SettingsScreen.tsx              # Quality, FPS, Bitrate, Audio toggles
│   │   ├── components/
│   │   │   ├── RecordingTimer.tsx              # Monospace 00:00:00 live timer
│   │   │   └── RecordingCompleteModal.tsx      # "Recording Complete" with Save / Cancel
│   │   ├── services/
│   │   │   └── ScreenRecorderNative.ts         # TypeScript Native Module API
│   │   ├── utils/
│   │   │   └── permissions.ts                  # Android runtime permissions handler
│   │   ├── types/
│   │   │   └── index.ts                        # TypeScript interfaces
│   │   └── App.native.tsx                      # Root React Native component
│   └── App.tsx                                 # Live Interactive Preview & Inspector
├── index.js                                    # React Native entry point
└── package.json
```

---

## 🚀 Exact CLI Commands

### 1. Install Dependencies
```bash
npm install
```

### 2. Run on Connected Physical Android Phone or Emulator
```bash
npx react-native run-android
```

### 3. Build Standalone Release APK (For Direct Device Installation)
```bash
cd android && ./gradlew assembleRelease
```
The resulting APK is created at:
`android/app/build/outputs/apk/release/app-release.apk`

### 4. Build Release Android App Bundle (AAB for Google Play Store)
```bash
cd android && ./gradlew bundleRelease
```
The resulting AAB is created at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## 🔧 Android Studio & Device Configuration

1. **Open Android Project**: Open the `/android` directory in Android Studio (Koala / Iguana / Hedgehog).
2. **SDK Configuration**:
   - Install **Android 14.0 (API 34)** or **Android 15 (API 35)** in SDK Manager.
   - Install **Android SDK Build-Tools 34.0.0** and **NDK 26.1+**.
3. **Physical Android Device Setup**:
   - Enable **Developer Options** (tap Build Number 7 times in Settings > About Phone).
   - Enable **USB Debugging**.
   - Connect via USB and verify by running:
     ```bash
     adb devices
     ```

---

## 🧠 How MediaProjection Architecture Works

1. **System Permission Request**: React Native calls `ScreenRecordModule.startRecording()`. The module uses `MediaProjectionManager.createScreenCaptureIntent()` and invokes `currentActivity.startActivityForResult()`. Android displays the native security prompt ("Start recording or casting with Screen Recorder?").
2. **Foreground Service Promotion**: Upon receiving `Activity.RESULT_OK`, the module starts `ScreenRecordService` with `FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION`. Under Android 14+ rules, this service must be active before accessing the `MediaProjection` token.
3. **VirtualDisplay & MediaRecorder Pipeline**: The service initializes `MediaRecorder` with surface video input and AAC microphone audio, then creates a `VirtualDisplay` mirroring the phone's physical display metrics (`DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR`).
4. **Lifecycle & Notifications**: An ongoing persistent notification is displayed with live timer ticks. Users can leave the app while recording continues smoothly in the background. The user can tap "Stop Recording" in either the app or the notification shade.
5. **MediaStore Export**: When stopped, `MediaStoreHelper` saves the temporary MP4 to `MediaStore.Video.Media.EXTERNAL_CONTENT_URI` under `Movies/ScreenRecordings`, making it instantly accessible in Google Photos / Gallery.
