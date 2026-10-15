package com.screenrecorder.recording

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.PendingRecording
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import com.screenrecorder.MainActivity
import com.screenrecorder.R
import java.io.File

class CameraRecordService : LifecycleService() {

    private val binder = LocalBinder()
    private var cameraProvider: ProcessCameraProvider? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null

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
    var onStoppedListener: ((String, String, Long, Long) -> Unit)? = null // galleryUri, filePath, duration, fileSize

    inner class LocalBinder : Binder() {
        fun getService(): CameraRecordService = this@CameraRecordService
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return binder
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            super.onStartCommand(intent, flags, startId)
            val action = intent?.action ?: return START_NOT_STICKY

            Log.d(TAG, "CameraRecordService action: $action")

            when (action) {
                ACTION_START -> {
                    val facing = intent.getStringExtra(EXTRA_FACING) ?: "back"
                    val recordAudio = intent.getBooleanExtra(EXTRA_RECORD_AUDIO, true)

                    startForegroundWithNotification()
                    initCameraAndStartRecording(facing, recordAudio)
                }
                ACTION_STOP -> {
                    stopCameraRecording()
                }
                ACTION_PAUSE -> pauseCameraRecording()
                ACTION_RESUME -> resumeCameraRecording()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in CameraRecordService onStartCommand: ${e.message}", e)
        }
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Background Camera Recording",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows camera recording status and controls"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
        }
    }

    private fun startForegroundWithNotification() {
        val notification = buildNotification("00:00:00", isPaused = false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            var serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            if (Build.VERSION.SDK_INT >= 34) {
                val hasAudioPerm = ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                if (hasAudioPerm) {
                    serviceType = serviceType or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                }
            }
            startForeground(NOTIFICATION_ID, notification, serviceType)
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
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

        val stopIntent = Intent(this, CameraRecordService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 10, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val pauseOrResumeIntent = Intent(this, CameraRecordService::class.java).apply {
            action = if (isPaused) ACTION_RESUME else ACTION_PAUSE
        }
        val pauseOrResumePendingIntent = PendingIntent.getService(
            this, 11, pauseOrResumeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Camera Recording Active")
            .setContentText("Duration: $timerText")
            .setSmallIcon(if (R.drawable.ic_notification != 0) R.drawable.ic_notification else android.R.drawable.ic_menu_camera)
            .setContentIntent(openAppPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(
                0,
                if (isPaused) "Resume" else "Pause",
                pauseOrResumePendingIntent
            )
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

    private fun initCameraAndStartRecording(facing: String, recordAudio: Boolean) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()

                val cameraSelector = if (facing.equals("front", ignoreCase = true)) {
                    CameraSelector.DEFAULT_FRONT_CAMERA
                } else {
                    CameraSelector.DEFAULT_BACK_CAMERA
                }

                val qualitySelector = QualitySelector.from(
                    Quality.HIGHEST,
                    FallbackStrategy.higherQualityOrLowerThan(Quality.SD)
                )

                val recorder = Recorder.Builder()
                    .setQualitySelector(qualitySelector)
                    .build()

                videoCapture = VideoCapture.withOutput(recorder)

                cameraProvider?.unbindAll()
                cameraProvider?.bindToLifecycle(this, cameraSelector, videoCapture)

                val dir = File(cacheDir, "camera_recordings").apply { if (!exists()) mkdirs() }
                outputFile = File(dir, "cam_rec_${System.currentTimeMillis()}.mp4")

                val fileOutputOptions = FileOutputOptions.Builder(outputFile!!).build()

                val pendingRecording: PendingRecording = recorder.prepareRecording(this, fileOutputOptions)

                if (recordAudio && ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    pendingRecording.withAudioEnabled()
                }

                activeRecording = pendingRecording.start(ContextCompat.getMainExecutor(this)) { recordEvent ->
                    when (recordEvent) {
                        is VideoRecordEvent.Start -> {
                            isRecording = true
                            isPaused = false
                            startTimeMillis = System.currentTimeMillis()
                            pausedDurationMillis = 0L
                            handler.post(timerRunnable)
                            onStateChangedListener?.invoke(true, false)
                            Log.i(TAG, "Camera recording started successfully: ${outputFile?.absolutePath}")
                        }
                        is VideoRecordEvent.Pause -> {
                            isPaused = true
                            pauseTimestampMillis = System.currentTimeMillis()
                            onStateChangedListener?.invoke(true, true)
                        }
                        is VideoRecordEvent.Resume -> {
                            isPaused = false
                            pausedDurationMillis += (System.currentTimeMillis() - pauseTimestampMillis)
                            onStateChangedListener?.invoke(true, false)
                        }
                        is VideoRecordEvent.Finalize -> {
                            val durationMillis = getRecordingDuration()
                            isRecording = false
                            isPaused = false
                            handler.removeCallbacks(timerRunnable)

                            if (!recordEvent.hasError() && outputFile != null && outputFile!!.exists() && outputFile!!.length() > 0) {
                                val galleryUri = MediaStoreHelper.saveVideoToGallery(this, outputFile!!, "CameraRecording")
                                val uriString = galleryUri?.toString() ?: ""
                                val pathString = outputFile?.absolutePath ?: ""
                                val fileSize = outputFile?.length() ?: 0L

                                onStoppedListener?.invoke(uriString, pathString, durationMillis, fileSize)
                                Log.i(TAG, "Camera recording saved to Gallery: $uriString")
                            } else {
                                Log.e(TAG, "Camera recording finalize error: ${recordEvent.error}")
                                onStoppedListener?.invoke("", outputFile?.absolutePath ?: "", durationMillis, 0L)
                            }

                            cleanupAndStop()
                        }
                    }
                }

            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize CameraX or start recording: ${e.message}", e)
                cleanupAndStop()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    fun pauseCameraRecording() {
        if (isRecording && !isPaused) {
            try {
                activeRecording?.pause()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to pause camera recording: ${e.message}")
            }
        }
    }

    fun resumeCameraRecording() {
        if (isRecording && isPaused) {
            try {
                activeRecording?.resume()
            } catch (e: Exception) {
                Log.e(TAG, "Failed to resume camera recording: ${e.message}")
            }
        }
    }

    fun stopCameraRecording() {
        if (!isRecording && activeRecording == null) {
            cleanupAndStop()
            return
        }
        try {
            activeRecording?.stop()
            activeRecording = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping active recording: ${e.message}")
            cleanupAndStop()
        }
    }

    private fun cleanupAndStop() {
        isRecording = false
        isPaused = false
        handler.removeCallbacks(timerRunnable)
        try {
            cameraProvider?.unbindAll()
        } catch (_: Exception) {}
        activeRecording = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        onStateChangedListener?.invoke(false, false)
    }

    override fun onDestroy() {
        cleanupAndStop()
        super.onDestroy()
    }

    fun getRecordingDuration(): Long {
        return if (isRecording) {
            val activePauseMillis = if (isPaused) System.currentTimeMillis() - pauseTimestampMillis else 0L
            System.currentTimeMillis() - startTimeMillis - pausedDurationMillis - activePauseMillis
        } else 0L
    }

    fun getIsRecording(): Boolean = isRecording
    fun getIsPaused(): Boolean = isPaused

    companion object {
        private const val TAG = "CameraRecordService"
        const val CHANNEL_ID = "CameraRecordingChannel"
        const val NOTIFICATION_ID = 2002

        const val ACTION_START = "com.screenrecorder.ACTION_START_CAMERA"
        const val ACTION_STOP = "com.screenrecorder.ACTION_STOP_CAMERA"
        const val ACTION_PAUSE = "com.screenrecorder.ACTION_PAUSE_CAMERA"
        const val ACTION_RESUME = "com.screenrecorder.ACTION_RESUME_CAMERA"

        const val EXTRA_FACING = "extra_facing"
        const val EXTRA_RECORD_AUDIO = "extra_record_audio"
    }
}
