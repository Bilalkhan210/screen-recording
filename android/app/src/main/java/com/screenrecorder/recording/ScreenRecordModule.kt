package com.screenrecorder.recording

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class ScreenRecordModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pendingStartPromise: Promise? = null
    private var pendingStopPromise: Promise? = null
    private var projectionResultCode: Int? = null
    private var projectionData: Intent? = null
    private var overlayStopRequested = false

    private var recordService: ScreenRecordService? = null
    private var isServiceBound = false

    private var targetWidth = 1080
    private var targetHeight = 1920
    private var targetFps = 60
    private var targetBitrate = 8000000
    private var targetRecordAudio = true
    private var targetShowCamera = false

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

            recordService?.onStateChangedListener = { recording, paused ->
                val map = Arguments.createMap().apply {
                    putBoolean("isRecording", recording)
                    putBoolean("isPaused", paused)
                }
                sendEvent("onStateChanged", map)
            }

            pendingStopPromise?.let { promise ->
                pendingStopPromise = null
                stopBoundService(promise)
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

    override fun getConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "REQUEST_CODE_MEDIA_PROJECTION" to REQUEST_MEDIA_PROJECTION
        )
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun startRecording(options: ReadableMap?, promise: Promise) {
        val currentActivity = reactContext.currentActivity
        if (currentActivity == null) {
            promise.reject("ERR_NO_ACTIVITY", "Current activity is null")
            return
        }

        if (recordService?.getIsRecording() == true) {
            promise.reject("ERR_ALREADY_RECORDING", "Screen recording is already active")
            return
        }

        pendingStartPromise = promise

        // Parse options
        val wm = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)

        targetWidth = if (options?.hasKey("width") == true) options.getInt("width") else metrics.widthPixels
        targetHeight = if (options?.hasKey("height") == true) options.getInt("height") else metrics.heightPixels

        // Cap to device dimensions to prevent encoder crashes on mid-range devices
        if (targetWidth > metrics.widthPixels) targetWidth = metrics.widthPixels
        if (targetHeight > metrics.heightPixels) targetHeight = metrics.heightPixels

        targetFps = if (options?.hasKey("fps") == true) options.getInt("fps") else 60
        targetBitrate = if (options?.hasKey("bitrate") == true) options.getInt("bitrate") else 8000000
        targetRecordAudio = if (options?.hasKey("recordAudio") == true) options.getBoolean("recordAudio") else true
        targetShowCamera = if (options?.hasKey("showCamera") == true) options.getBoolean("showCamera") else false

        // Ensure even dimensions for H.264 encoder
        if (targetWidth % 2 != 0) targetWidth -= 1
        if (targetHeight % 2 != 0) targetHeight -= 1

        val projectionManager = reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        val captureIntent = projectionManager.createScreenCaptureIntent()

        try {
            currentActivity.startActivityForResult(captureIntent, REQUEST_MEDIA_PROJECTION)
        } catch (e: Exception) {
            pendingStartPromise?.reject("ERR_CAPTURE_INTENT", "Failed to launch screen capture intent: ${e.message}")
            pendingStartPromise = null
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                projectionResultCode = resultCode
                projectionData = data

                val result = Arguments.createMap().apply {
                    putBoolean("permissionGranted", true)
                }
                pendingStartPromise?.resolve(result)
                pendingStartPromise = null
            } else {
                pendingStartPromise?.reject("ERR_PERMISSION_DENIED", "MediaProjection permission denied by user")
                pendingStartPromise = null
            }
        }
    }

    @ReactMethod
    fun beginRecording(promise: Promise) {
        val resultCode = projectionResultCode
        val resultData = projectionData
        if (resultCode == null || resultData == null) {
            promise.reject("ERR_CAPTURE_PERMISSION", "Screen capture permission has not been granted")
            return
        }

        val wm = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(metrics)

        val serviceIntent = Intent(reactContext, ScreenRecordService::class.java).apply {
            action = ScreenRecordService.ACTION_START
            putExtra(ScreenRecordService.EXTRA_RESULT_CODE, resultCode)
            putExtra(ScreenRecordService.EXTRA_RESULT_DATA, resultData)
            putExtra(ScreenRecordService.EXTRA_WIDTH, targetWidth)
            putExtra(ScreenRecordService.EXTRA_HEIGHT, targetHeight)
            putExtra(ScreenRecordService.EXTRA_DPI, metrics.densityDpi)
            putExtra(ScreenRecordService.EXTRA_FPS, targetFps)
            putExtra(ScreenRecordService.EXTRA_BITRATE, targetBitrate)
            putExtra(ScreenRecordService.EXTRA_RECORD_AUDIO, targetRecordAudio)
            putExtra(ScreenRecordService.EXTRA_SHOW_CAMERA, targetShowCamera)
        }

        try {
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
            promise.resolve(result)
            sendEvent("onRecordingStarted", result)
            projectionResultCode = null
            projectionData = null
        } catch (e: Exception) {
            promise.reject("ERR_START_FAILED", "Failed to start recording: ${e.message}")
        }
    }

    @ReactMethod
    fun hasMicrophonePermission(promise: Promise) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            reactContext.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        promise.resolve(granted)
    }

    override fun onNewIntent(intent: Intent) {
        if (intent.action == ScreenRecordService.ACTION_REQUEST_STOP_FROM_OVERLAY) {
            overlayStopRequested = true
            sendEvent("onOverlayStopRequested", null)
        }
    }

    @ReactMethod
    fun consumeOverlayStopRequest(promise: Promise) {
        promise.resolve(overlayStopRequested)
        overlayStopRequested = false
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        val service = recordService
        if (service == null) {
            pendingStopPromise = promise
            val bindIntent = Intent(reactContext, ScreenRecordService::class.java)
            try {
                reactContext.bindService(bindIntent, serviceConnection, Context.BIND_AUTO_CREATE)
            } catch (e: Exception) {
                pendingStopPromise = null
                promise.reject("ERR_NOT_RECORDING", "Could not connect to recording service")
            }
            return
        }

        if (!service.getIsRecording()) {
            promise.reject("ERR_NOT_RECORDING", "No screen recording session is currently running")
            return
        }

        stopBoundService(promise)
    }

    private fun stopBoundService(promise: Promise) {
        val service = recordService
        if (service == null || !service.getIsRecording()) {
            promise.reject("ERR_NOT_RECORDING", "No screen recording session is currently running")
            return
        }
        try {
            val durationMillis = service.getRecordingDuration()
            val videoFile = service.stopRecording()

            if (isServiceBound) {
                try {
                    reactContext.unbindService(serviceConnection)
                } catch (_: Exception) {}
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
            promise.reject("ERR_STOP_FAILED", "Failed to stop recording: ${e.message}")
        }
    }

    @ReactMethod
    fun pauseRecording(promise: Promise) {
        recordService?.pauseRecording()
        promise.resolve(true)
    }

    @ReactMethod
    fun resumeRecording(promise: Promise) {
        recordService?.resumeRecording()
        promise.resolve(true)
    }

    @ReactMethod
    fun isRecording(promise: Promise) {
        promise.resolve(recordService?.getIsRecording() ?: false)
    }

    @ReactMethod
    fun getRecordingDuration(promise: Promise) {
        promise.resolve((recordService?.getRecordingDuration() ?: 0L).toDouble())
    }

    @ReactMethod
    fun saveToGallery(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("ERR_FILE_NOT_FOUND", "File does not exist at $filePath")
                return
            }

            val savedUri = MediaStoreHelper.saveVideoToGallery(reactContext, file)
            if (savedUri != null) {
                // Delete temp file after successful gallery export
                file.delete()
                val map = Arguments.createMap().apply {
                    putBoolean("success", true)
                    putString("galleryUri", savedUri.toString())
                    putString("message", "Video saved to Gallery successfully")
                }
                promise.resolve(map)
            } else {
                promise.reject("ERR_SAVE_FAILED", "Could not save video to Android MediaStore")
            }
        } catch (e: Exception) {
            promise.reject("ERR_SAVE_EXCEPTION", "Exception while saving video: ${e.message}")
        }
    }

    @ReactMethod
    fun discardRecording(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (file.exists()) {
                val deleted = file.delete()
                promise.resolve(deleted)
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("ERR_DISCARD", "Failed to discard recording: ${e.message}")
        }
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            promise.resolve(Settings.canDrawOverlays(reactContext))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(reactContext)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactContext.packageName}")
                )
                reactContext.currentActivity?.startActivity(intent)
                promise.resolve(false)
            } else {
                promise.resolve(true)
            }
        } else {
            promise.resolve(true)
        }
    }

    companion object {
        const val REQUEST_MEDIA_PROJECTION = 1001
        private const val TAG = "ScreenRecordModule"
    }
}
