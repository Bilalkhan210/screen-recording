export interface NativeProjectFile {
  path: string;
  filename: string;
  category: 'manifest' | 'kotlin' | 'gradle' | 'react-native' | 'config';
  language: string;
  description: string;
  code: string;
}

export const PROJECT_FILES: NativeProjectFile[] = [
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    filename: 'AndroidManifest.xml',
    category: 'manifest',
    language: 'xml',
    description: 'Declares Android 14+ MediaProjection foreground service, notification & audio permissions.',
    code: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.screenrecorder">

    <!-- Permissions required for screen recording and foreground service -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <!-- Storage permissions for Android 12 and below; Scoped Storage used on Android 10+ -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:allowBackup="false"
        android:theme="@style/AppTheme"
        android:requestLegacyExternalStorage="false">

        <activity
            android:name=".MainActivity"
            android:label="@string/app_name"
            android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
            android:launchMode="singleTask"
            android:windowSoftInputMode="adjustResize"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- MediaProjection Foreground Service for Android 14+ compliance -->
        <service
            android:name=".recording.ScreenRecordService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaProjection" />

    </application>
</manifest>`,
  },
  {
    path: 'android/app/src/main/java/com/screenrecorder/recording/ScreenRecordService.kt',
    filename: 'ScreenRecordService.kt',
    category: 'kotlin',
    language: 'kotlin',
    description: 'Foreground Service running MediaProjection, VirtualDisplay, MediaRecorder, persistent notification & timer.',
    code: `package com.screenrecorder.recording

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.screenrecorder.MainActivity
import com.screenrecorder.R
import java.io.File

class ScreenRecordService : Service() {

    private val binder = LocalBinder()
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var mediaRecorder: MediaRecorder? = null

    private var isRecording = false
    private var isPaused = false
    private var outputFile: File? = null
    private var startTimeMillis = 0L
    private var pausedDurationMillis = 0L
    private var pauseTimestampMillis = 0L

    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            if (isRecording && !isPaused) {
                val elapsed = System.currentTimeMillis() - startTimeMillis - pausedDurationMillis
                updateNotificationTimer(elapsed)
                onTickListener?.invoke(elapsed)
                handler.postDelayed(this, 1000)
            }
        }
    }

    var onTickListener: ((Long) -> Unit)? = null
    var onStateChangedListener: ((Boolean, Boolean) -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun getService(): ScreenRecordService = this@ScreenRecordService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: return START_NOT_STICKY

        when (action) {
            ACTION_START -> {
                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
                val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
                val width = intent.getIntExtra(EXTRA_WIDTH, 1080)
                val height = intent.getIntExtra(EXTRA_HEIGHT, 1920)
                val dpi = intent.getIntExtra(EXTRA_DPI, 400)
                val fps = intent.getIntExtra(EXTRA_FPS, 60)
                val bitrate = intent.getIntExtra(EXTRA_BITRATE, 8000000)
                val recordAudio = intent.getBooleanExtra(EXTRA_RECORD_AUDIO, true)

                startForegroundWithNotification()
                if (resultData != null && resultCode != 0) {
                    initRecording(resultCode, resultData, width, height, dpi, fps, bitrate, recordAudio)
                } else {
                    stopSelf()
                }
            }
            ACTION_STOP -> stopRecording()
            ACTION_PAUSE -> pauseRecording()
            ACTION_RESUME -> resumeRecording()
        }
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen Recording Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows recording status and controls"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundWithNotification() {
        val notification = buildNotification("00:00:00", isPaused = false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(timerText: String, isPaused: Boolean): Notification {
        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, ScreenRecordService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 1, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Recording Active")
            .setContentText("Duration: $timerText")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(openAppPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, "Stop Recording", stopPendingIntent)
            .build()
    }

    private fun updateNotificationTimer(elapsedMillis: Long) {
        val seconds = (elapsedMillis / 1000) % 60
        val minutes = (elapsedMillis / (1000 * 60)) % 60
        val hours = (elapsedMillis / (1000 * 60 * 60))
        val timerString = String.format("%02d:%02d:%02d", hours, minutes, seconds)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, buildNotification(timerString, isPaused))
    }

    private fun initRecording(
        resultCode: Int,
        resultData: Intent,
        width: Int,
        height: Int,
        dpi: Int,
        fps: Int,
        bitrate: Int,
        recordAudio: Boolean
    ) {
        try {
            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            mediaProjection = projectionManager.getMediaProjection(resultCode, resultData)

            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    stopRecording()
                }
            }, handler)

            val dir = File(cacheDir, "recordings").apply { if (!exists()) mkdirs() }
            outputFile = File(dir, "rec_\${System.currentTimeMillis()}.mp4")

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            mediaRecorder?.apply {
                if (recordAudio) {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                }
                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setOutputFile(outputFile?.absolutePath)
                setVideoSize(width, height)
                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                if (recordAudio) {
                    setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                    setAudioEncodingBitRate(128000)
                    setAudioSamplingRate(44100)
                }
                setVideoEncodingBitRate(bitrate)
                setVideoFrameRate(fps)
                prepare()
            }

            val surface = mediaRecorder?.surface
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenRecordServiceDisplay",
                width,
                height,
                dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                surface,
                null,
                null
            )

            mediaRecorder?.start()
            isRecording = true
            isPaused = false
            startTimeMillis = System.currentTimeMillis()
            pausedDurationMillis = 0L

            handler.post(timerRunnable)
            onStateChangedListener?.invoke(true, false)
        } catch (e: Exception) {
            Log.e("ScreenRecordService", "Failed to start screen recording: \${e.message}", e)
            cleanup()
            stopSelf()
        }
    }

    fun stopRecording(): File? {
        if (!isRecording) return null
        isRecording = false
        isPaused = false
        handler.removeCallbacks(timerRunnable)

        try {
            mediaRecorder?.apply {
                try { stop() } catch (_: Exception) {}
                reset()
                release()
            }
        } finally {
            mediaRecorder = null
        }

        try { virtualDisplay?.release() } finally { virtualDisplay = null }
        try { mediaProjection?.stop() } finally { mediaProjection = null }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        onStateChangedListener?.invoke(false, false)
        return outputFile
    }

    private fun cleanup() {
        isRecording = false
        isPaused = false
        handler.removeCallbacks(timerRunnable)
        try { mediaRecorder?.release() } catch (_: Exception) {}
        try { virtualDisplay?.release() } catch (_: Exception) {}
        try { mediaProjection?.stop() } catch (_: Exception) {}
        mediaRecorder = null
        virtualDisplay = null
        mediaProjection = null
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    fun getRecordingDuration(): Long {
        return if (isRecording) {
            System.currentTimeMillis() - startTimeMillis - pausedDurationMillis
        } else 0L
    }

    fun getIsRecording(): Boolean = isRecording

    companion object {
        const val CHANNEL_ID = "ScreenRecordingChannel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "com.screenrecorder.ACTION_START"
        const val ACTION_STOP = "com.screenrecorder.ACTION_STOP"
        const val ACTION_PAUSE = "com.screenrecorder.ACTION_PAUSE"
        const val ACTION_RESUME = "com.screenrecorder.ACTION_RESUME"

        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"
        const val EXTRA_WIDTH = "extra_width"
        const val EXTRA_HEIGHT = "extra_height"
        const val EXTRA_DPI = "extra_dpi"
        const val EXTRA_FPS = "extra_fps"
        const val EXTRA_BITRATE = "extra_bitrate"
        const val EXTRA_RECORD_AUDIO = "extra_record_audio"
    }
}`,
  },
  {
    path: 'android/app/src/main/java/com/screenrecorder/recording/ScreenRecordModule.kt',
    filename: 'ScreenRecordModule.kt',
    category: 'kotlin',
    language: 'kotlin',
    description: 'React Native Bridge Module. Handles MediaProjection user consent intent, service binding, and events.',
    code: `package com.screenrecorder.recording

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import android.util.DisplayMetrics
import android.view.WindowManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class ScreenRecordModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pendingStartPromise: Promise? = null
    private var recordService: ScreenRecordService? = null
    private var isServiceBound = false

    private var targetWidth = 1080
    private var targetHeight = 1920
    private var targetFps = 60
    private var targetBitrate = 8000000
    private var targetRecordAudio = true

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as ScreenRecordService.LocalBinder
            recordService = binder.getService()
            isServiceBound = true

            recordService?.onTickListener = { elapsedMillis ->
                val seconds = (elapsedMillis / 1000) % 60
                val minutes = (elapsedMillis / (1000 * 60)) % 60
                val hours = (elapsedMillis / (1000 * 60 * 60))
                val formatted = String.format("%02d:%02d:%02d", hours, minutes, seconds)

                val map = Arguments.createMap().apply {
                    putDouble("elapsedMillis", elapsedMillis.toDouble())
                    putString("formattedTime", formatted)
                }
                sendEvent("onTick", map)
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            recordService = null
            isServiceBound = false
        }
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "ScreenRecordModule"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun startRecording(options: ReadableMap?, promise: Promise) {
        val currentActivity = currentActivity ?: run {
            promise.reject("ERR_NO_ACTIVITY", "Current activity is null")
            return
        }

        if (recordService?.getIsRecording() == true) {
            promise.reject("ERR_ALREADY_RECORDING", "Screen recording is already active")
            return
        }

        pendingStartPromise = promise

        val wm = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)

        targetWidth = if (options?.hasKey("width") == true) options.getInt("width") else metrics.widthPixels
        targetHeight = if (options?.hasKey("height") == true) options.getInt("height") else metrics.heightPixels
        targetFps = if (options?.hasKey("fps") == true) options.getInt("fps") else 60
        targetBitrate = if (options?.hasKey("bitrate") == true) options.getInt("bitrate") else 8000000
        targetRecordAudio = if (options?.hasKey("recordAudio") == true) options.getBoolean("recordAudio") else true

        if (targetWidth % 2 != 0) targetWidth -= 1
        if (targetHeight % 2 != 0) targetHeight -= 1

        val projectionManager = reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val captureIntent = projectionManager.createScreenCaptureIntent()

        try {
            currentActivity.startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
        } catch (e: Exception) {
            pendingStartPromise?.reject("ERR_CAPTURE_INTENT", "Failed to launch screen capture intent: \${e.message}")
            pendingStartPromise = null
        }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val serviceIntent = Intent(reactContext, ScreenRecordService::class.java).apply {
                    action = ScreenRecordService.ACTION_START
                    putExtra(ScreenRecordService.EXTRA_RESULT_CODE, resultCode)
                    putExtra(ScreenRecordService.EXTRA_RESULT_DATA, data)
                    putExtra(ScreenRecordService.EXTRA_WIDTH, targetWidth)
                    putExtra(ScreenRecordService.EXTRA_HEIGHT, targetHeight)
                    putExtra(ScreenRecordService.EXTRA_FPS, targetFps)
                    putExtra(ScreenRecordService.EXTRA_BITRATE, targetBitrate)
                    putExtra(ScreenRecordService.EXTRA_RECORD_AUDIO, targetRecordAudio)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    reactContext.startForegroundService(serviceIntent)
                } else {
                    reactContext.startService(serviceIntent)
                }

                val bindIntent = Intent(reactContext, ScreenRecordService::class.java)
                reactContext.bindService(bindIntent, serviceConnection, Context.BIND_AUTO_CREATE)

                val result = Arguments.createMap().apply {
                    putBoolean("started", true)
                    putInt("width", targetWidth)
                    putInt("height", targetHeight)
                }
                pendingStartPromise?.resolve(result)
                pendingStartPromise = null
                sendEvent("onRecordingStarted", result)
            } else {
                pendingStartPromise?.reject("ERR_PERMISSION_DENIED", "MediaProjection permission denied by user")
                pendingStartPromise = null
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {}

    @ReactMethod
    fun stopRecording(promise: Promise) {
        val service = recordService ?: run {
            promise.reject("ERR_NOT_RECORDING", "No screen recording session running")
            return
        }

        try {
            val durationMillis = service.getRecordingDuration()
            val videoFile = service.stopRecording()

            if (isServiceBound) {
                try { reactContext.unbindService(serviceConnection) } catch (_: Exception) {}
                isServiceBound = false
            }

            if (videoFile != null && videoFile.exists()) {
                val result = Arguments.createMap().apply {
                    putString("filePath", videoFile.absolutePath)
                    putString("fileName", videoFile.name)
                    putDouble("durationMillis", durationMillis.toDouble())
                    putDouble("fileSize", videoFile.length().toDouble())
                    putInt("width", targetWidth)
                    putInt("height", targetHeight)
                }
                promise.resolve(result)
                sendEvent("onRecordingStopped", result)
            } else {
                promise.reject("ERR_FILE_NOT_FOUND", "Recorded video file was not generated")
            }
        } catch (e: Exception) {
            promise.reject("ERR_STOP_FAILED", "Failed to stop recording: \${e.message}")
        }
    }

    @ReactMethod
    fun saveToGallery(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("ERR_FILE_NOT_FOUND", "File does not exist")
                return
            }

            val savedUri = MediaStoreHelper.saveVideoToGallery(reactContext, file)
            if (savedUri != null) {
                file.delete()
                val map = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("galleryUri", savedUri.toString())
                }
                promise.resolve(map)
            } else {
                promise.reject("ERR_SAVE_FAILED", "Could not save video to Android MediaStore")
            }
        } catch (e: Exception) {
            promise.reject("ERR_SAVE_EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun discardRecording(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) file.delete()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_DISCARD", e.message)
        }
    }

    companion object {
        const val REQUEST_MEDIA_PROJECTION = 1001
    }
}`,
  },
  {
    path: 'android/app/src/main/java/com/screenrecorder/recording/MediaStoreHelper.kt',
    filename: 'MediaStoreHelper.kt',
    category: 'kotlin',
    language: 'kotlin',
    description: 'Scoped Storage & Android MediaStore exporter. Saves MP4 directly to Movies/ScreenRecordings in Gallery.',
    code: `package com.screenrecorder.recording

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.text.SimpleDateFormat
import java.util.*

object MediaStoreHelper {
    fun saveVideoToGallery(context: Context, tempVideoFile: File): Uri? {
        if (!tempVideoFile.exists() || tempVideoFile.length() == 0L) return null

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val displayName = "ScreenRecording_\$timestamp.mp4"
        val resolver: ContentResolver = context.contentResolver

        val contentValues = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.DATE_ADDED, System.currentTimeMillis() / 1000)
            put(MediaStore.Video.Media.DATE_MODIFIED, System.currentTimeMillis() / 1000)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Video.Media.RELATIVE_PATH, "\${Environment.DIRECTORY_MOVIES}/ScreenRecordings")
                put(MediaStore.Video.Media.IS_PENDING, 1)
            }
        }

        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        }

        var itemUri: Uri? = null
        try {
            itemUri = resolver.insert(collection, contentValues) ?: return null

            resolver.openOutputStream(itemUri)?.use { outputStream ->
                FileInputStream(tempVideoFile).use { inputStream ->
                    val buffer = ByteArray(64 * 1024)
                    var bytesRead: Int
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                    }
                    outputStream.flush()
                }
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear()
                contentValues.put(MediaStore.Video.Media.IS_PENDING, 0)
                resolver.update(itemUri, contentValues, null, null)
            }
            return itemUri
        } catch (e: Exception) {
            if (itemUri != null) {
                try { resolver.delete(itemUri, null, null) } catch (_: Exception) {}
            }
            return null
        }
    }
}`,
  },
  {
    path: 'src/rn/services/ScreenRecorderNative.ts',
    filename: 'ScreenRecorderNative.ts',
    category: 'react-native',
    language: 'typescript',
    description: 'TypeScript bridge wrapper for React Native. Provides typed promises and DeviceEventEmitter hooks.',
    code: `import { NativeModules, DeviceEventEmitter, EmitterSubscription } from 'react-native';
import { RecordingOptions, RecordingStartResult, RecordingStopResult, GallerySaveResult } from '../types';

const { ScreenRecordModule } = NativeModules;

export class ScreenRecorderService {
  static async startRecording(options?: RecordingOptions): Promise<RecordingStartResult> {
    if (!ScreenRecordModule) throw new Error('ScreenRecordModule native module is not available');
    return await ScreenRecordModule.startRecording(options || {});
  }

  static async stopRecording(): Promise<RecordingStopResult> {
    if (!ScreenRecordModule) throw new Error('ScreenRecordModule native module is not available');
    return await ScreenRecordModule.stopRecording();
  }

  static async pauseRecording(): Promise<boolean> {
    return await ScreenRecordModule.pauseRecording();
  }

  static async resumeRecording(): Promise<boolean> {
    return await ScreenRecordModule.resumeRecording();
  }

  static async isRecording(): Promise<boolean> {
    return await ScreenRecordModule.isRecording();
  }

  static async saveToGallery(filePath: string): Promise<GallerySaveResult> {
    return await ScreenRecordModule.saveToGallery(filePath);
  }

  static async discardRecording(filePath: string): Promise<boolean> {
    return await ScreenRecordModule.discardRecording(filePath);
  }

  static addTimerListener(listener: (data: { elapsedMillis: number; formattedTime: string }) => void): EmitterSubscription {
    return DeviceEventEmitter.addListener('onTick', listener);
  }

  static addStateListener(listener: (data: { isRecording: boolean; isPaused: boolean }) => void): EmitterSubscription {
    return DeviceEventEmitter.addListener('onStateChanged', listener);
  }

  static addStopListener(listener: (data: RecordingStopResult) => void): EmitterSubscription {
    return DeviceEventEmitter.addListener('onRecordingStopped', listener);
  }
}`,
  },
  {
    path: 'android/app/build.gradle',
    filename: 'app/build.gradle',
    category: 'gradle',
    language: 'groovy',
    description: 'Module build file configuring compileSdk 34, AndroidX, Kotlin plugin, and React Native dependencies.',
    code: `apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"

android {
    ndkVersion rootProject.ext.ndkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion
    compileSdk rootProject.ext.compileSdkVersion

    namespace "com.screenrecorder"
    defaultConfig {
        applicationId "com.screenrecorder"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0.0"
    }

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }

    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
            minifyEnabled false
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}`,
  },
];
