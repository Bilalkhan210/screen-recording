package com.screenrecorder.recording

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class CameraRecordModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var cameraService: CameraRecordService? = null
    private var isServiceBound = false
    private var pendingStopPromise: Promise? = null

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as CameraRecordService.LocalBinder
            cameraService = binder.getService()
            isServiceBound = true

            cameraService?.onTickListener = { elapsedMillis ->
                val seconds = (elapsedMillis / 1000) % 60
                val minutes = (elapsedMillis / (1000 * 60)) % 60
                val hours = (elapsedMillis / (1000 * 60 * 60))
                val formatted = String.format("%02d:%02d:%02d", hours, minutes, seconds)

                val map = Arguments.createMap().apply {
                    putDouble("elapsedMillis", elapsedMillis.toDouble())
                    putString("formattedTime", formatted)
                }
                sendEvent("onCameraTick", map)
            }

            cameraService?.onStateChangedListener = { recording, paused ->
                val map = Arguments.createMap().apply {
                    putBoolean("isRecording", recording)
                    putBoolean("isPaused", paused)
                }
                sendEvent("onCameraStateChanged", map)
            }

            cameraService?.onStoppedListener = { galleryUri, filePath, durationMillis, fileSize ->
                val result = Arguments.createMap().apply {
                    putString("galleryUri", galleryUri)
                    putString("filePath", filePath)
                    putDouble("durationMillis", durationMillis.toDouble())
                    putDouble("fileSize", fileSize.toDouble())
                }
                sendEvent("onCameraRecordingStopped", result)

                pendingStopPromise?.resolve(result)
                pendingStopPromise = null

                if (isServiceBound) {
                    try {
                        reactContext.unbindService(this)
                    } catch (_: Exception) {}
                    isServiceBound = false
                }
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            cameraService = null
            isServiceBound = false
        }
    }

    override fun getName(): String = "CameraRecordModule"

    private fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    @ReactMethod
    fun hasCameraPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactContext, android.Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    @ReactMethod
    fun startCameraRecording(options: ReadableMap?, promise: Promise) {
        val facing = if (options?.hasKey("facing") == true) options.getString("facing") ?: "back" else "back"
        val recordAudio = if (options?.hasKey("recordAudio") == true) options.getBoolean("recordAudio") else true

        val hasCameraPerm = ContextCompat.checkSelfPermission(
            reactContext, android.Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCameraPerm) {
            promise.reject("ERR_NO_CAMERA_PERMISSION", "Camera permission is required")
            return
        }

        val serviceIntent = Intent(reactContext, CameraRecordService::class.java).apply {
            action = CameraRecordService.ACTION_START
            putExtra(CameraRecordService.EXTRA_FACING, facing)
            putExtra(CameraRecordService.EXTRA_RECORD_AUDIO, recordAudio)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent)
            } else {
                reactContext.startService(serviceIntent)
            }

            val bindIntent = Intent(reactContext, CameraRecordService::class.java)
            reactContext.bindService(bindIntent, serviceConnection, Context.BIND_AUTO_CREATE)

            val map = Arguments.createMap().apply {
                putBoolean("started", true)
                putString("facing", facing)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ERR_START_CAMERA_FAILED", "Failed to start camera recording: ${e.message}")
        }
    }

    @ReactMethod
    fun stopCameraRecording(promise: Promise) {
        val service = cameraService
        if (service == null || !service.getIsRecording()) {
            val serviceIntent = Intent(reactContext, CameraRecordService::class.java).apply {
                action = CameraRecordService.ACTION_STOP
            }
            try {
                reactContext.startService(serviceIntent)
                val map = Arguments.createMap().apply {
                    putBoolean("stopped", true)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                promise.reject("ERR_STOP_FAILED", "Could not stop camera recording service: ${e.message}")
            }
            return
        }

        pendingStopPromise = promise
        service.stopCameraRecording()
    }

    @ReactMethod
    fun pauseCameraRecording(promise: Promise) {
        cameraService?.pauseCameraRecording()
        promise.resolve(true)
    }

    @ReactMethod
    fun resumeCameraRecording(promise: Promise) {
        cameraService?.resumeCameraRecording()
        promise.resolve(true)
    }

    @ReactMethod
    fun isCameraRecording(promise: Promise) {
        promise.resolve(cameraService?.getIsRecording() ?: false)
    }

    @ReactMethod
    fun getCameraRecordingDuration(promise: Promise) {
        promise.resolve((cameraService?.getRecordingDuration() ?: 0L).toDouble())
    }
}
