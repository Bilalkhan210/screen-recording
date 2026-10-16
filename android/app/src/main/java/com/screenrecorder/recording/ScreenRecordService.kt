package com.screenrecorder.recording

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
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
import android.view.WindowManager
import android.view.Gravity
import android.graphics.PixelFormat
import android.view.View
import android.view.MotionEvent
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import com.screenrecorder.MainActivity
import com.screenrecorder.R
import java.io.File

class ScreenRecordService : LifecycleService() {

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

    // Camera Overlay fields
    private var windowManager: WindowManager? = null
    private var cameraOverlayView: View? = null
    private var isCameraShowing = false
    private var controlOverlayView: View? = null
    private var controlMenuView: View? = null

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
    var onStoppedListener: ((File?, Long) -> Unit)? = null

    inner class LocalBinder : Binder() {
        fun getService(): ScreenRecordService = this@ScreenRecordService
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
            val action = intent?.action
            if (action == null) {
                Log.e(TAG, "Start command received with null action")
                return START_NOT_STICKY
            }

            Log.d(TAG, "onStartCommand action: $action")

            when (action) {
                ACTION_START -> {
                    val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
                    val resultData: Intent? = try {
                        if (Build.VERSION.SDK_INT >= 33) {
                            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(EXTRA_RESULT_DATA) as? Intent
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to unparcel resultData intent: ${e.message}")
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(EXTRA_RESULT_DATA) as? Intent
                    }

                    val width = intent.getIntExtra(EXTRA_WIDTH, 1080)
                    val height = intent.getIntExtra(EXTRA_HEIGHT, 1920)
                    val dpi = intent.getIntExtra(EXTRA_DPI, 400)
                    val fps = intent.getIntExtra(EXTRA_FPS, 60)
                    val bitrate = intent.getIntExtra(EXTRA_BITRATE, 8000000)
                    val recordAudio = intent.getBooleanExtra(EXTRA_RECORD_AUDIO, true)
                    val showCamera = intent.getBooleanExtra(EXTRA_SHOW_CAMERA, false)

                    startForegroundWithNotification(showCamera, recordAudio)

                    if (resultData != null && resultCode != 0) {
                        initRecording(resultCode, resultData, width, height, dpi, fps, bitrate, recordAudio)
                        showRecordingControl()
                        if (showCamera) {
                            showCameraOverlay()
                        }
                    } else {
                        Log.e(TAG, "Missing MediaProjection data. ResultCode: $resultCode, Data: ${resultData != null}")
                        try {
                            stopForeground(STOP_FOREGROUND_REMOVE)
                        } catch (_: Exception) {}
                        stopSelf()
                    }
                }
                ACTION_STOP -> {
                    val durationMillis = getRecordingDuration()
                    val resultFile = stopRecording()
                    onStoppedListener?.invoke(resultFile, durationMillis)
                }
                ACTION_PAUSE -> pauseRecording()
                ACTION_RESUME -> resumeRecording()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in onStartCommand: ${e.message}", e)
            try {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } catch (_: Exception) {}
            stopSelf()
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

    private fun startForegroundWithNotification(showCamera: Boolean, recordAudio: Boolean) {
        val notification = buildNotification("00:00:00", isPaused = false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
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

        val pauseOrResumeIntent = Intent(this, ScreenRecordService::class.java).apply {
            action = if (isPaused) ACTION_RESUME else ACTION_PAUSE
        }
        val pauseOrResumePendingIntent = PendingIntent.getService(
            this, 2, pauseOrResumeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val iconRes = if (R.drawable.ic_notification != 0) R.drawable.ic_notification else android.R.drawable.ic_menu_camera

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Screen Recording Active")
            .setContentText("Duration: $timerText")
            .setSmallIcon(iconRes)
            .setContentIntent(openAppPendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
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

            if (mediaProjection == null) {
                Log.e(TAG, "Failed to get MediaProjection instance")
                cleanup()
                stopSelf()
                return
            }

            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    super.onStop()
                    Log.w(TAG, "MediaProjection session stopped by system")
                    stopRecording()
                }

                override fun onCapturedContentResize(newWidth: Int, newHeight: Int) {
                    if (newWidth > 0 && newHeight > 0) {
                        handler.post {
                            try {
                                val alignedW = (newWidth / 16) * 16
                                val alignedH = (newHeight / 16) * 16
                                if (alignedW > 0 && alignedH > 0) {
                                    virtualDisplay?.resize(alignedW, alignedH, dpi)
                                }
                            } catch (e: Exception) {
                                Log.w(TAG, "Failed to resize virtual display: ${e.message}")
                            }
                        }
                    }
                }
            }, handler)

            val dir = File(cacheDir, "recordings").apply { if (!exists()) mkdirs() }
            outputFile = File(dir, "rec_${System.currentTimeMillis()}.mp4")

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            // Cap base dimensions to 1080p width to guarantee compatibility with Google Pixel / Tensor H.264 encoder limits
            var baseWidth = width
            var baseHeight = height
            if (baseWidth > 1080) {
                val ratio = baseHeight.toDouble() / baseWidth.toDouble()
                baseWidth = 1080
                baseHeight = (1080 * ratio).toInt()
            }
            baseWidth = (baseWidth / 16) * 16
            baseHeight = (baseHeight / 16) * 16
            if (baseWidth <= 0) baseWidth = 720
            if (baseHeight <= 0) baseHeight = 1280

            var preparedSuccess = false
            var finalRecordWidth = baseWidth
            var finalRecordHeight = baseHeight

            val widthsToTry = intArrayOf(baseWidth, 720, 540)
            val bitratesToTry = intArrayOf(bitrate, 6000000, 4000000)

            for (w in widthsToTry) {
                if (preparedSuccess) break
                val ratio = baseHeight.toDouble() / baseWidth.toDouble()
                val curW = (w / 16) * 16
                val curH = ((w * ratio).toInt() / 16) * 16

                for (b in bitratesToTry) {
                    if (preparedSuccess) break

                    // Attempt 1: Screen + Mic Audio
                    if (recordAudio) {
                        try {
                            mediaRecorder?.reset()
                            mediaRecorder?.apply {
                                setAudioSource(MediaRecorder.AudioSource.MIC)
                                setVideoSource(MediaRecorder.VideoSource.SURFACE)
                                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                                setOutputFile(outputFile?.absolutePath)
                                setVideoSize(curW, curH)
                                setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                                setAudioEncodingBitRate(128000)
                                setAudioSamplingRate(44100)
                                setVideoEncodingBitRate(b)
                                setVideoFrameRate(fps.coerceAtMost(60))
                                prepare()
                            }
                            preparedSuccess = true
                            finalRecordWidth = curW
                            finalRecordHeight = curH
                            Log.i(TAG, "MediaRecorder prepared with audio: ${curW}x${curH} @ ${b}bps")
                            break
                        } catch (ex: Exception) {
                            Log.w(TAG, "MediaRecorder audio prepare failed at ${curW}x${curH} @ ${b}bps: ${ex.message}")
                        }
                    }

                    // Attempt 2: Video Only
                    try {
                        mediaRecorder?.reset()
                        mediaRecorder?.apply {
                            setVideoSource(MediaRecorder.VideoSource.SURFACE)
                            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                            setOutputFile(outputFile?.absolutePath)
                            setVideoSize(curW, curH)
                            setVideoEncoder(MediaRecorder.VideoEncoder.H264)
                            setVideoEncodingBitRate(b)
                            setVideoFrameRate(fps.coerceAtMost(60))
                            prepare()
                        }
                        preparedSuccess = true
                        finalRecordWidth = curW
                        finalRecordHeight = curH
                        Log.i(TAG, "MediaRecorder prepared (video-only): ${curW}x${curH} @ ${b}bps")
                        break
                    } catch (ex: Exception) {
                        Log.w(TAG, "MediaRecorder video-only prepare failed at ${curW}x${curH} @ ${b}bps: ${ex.message}")
                    }
                }
            }

            if (!preparedSuccess) {
                Log.e(TAG, "Failed to prepare MediaRecorder across all fallback resolutions")
                cleanup()
                stopSelf()
                return
            }

            val surface = mediaRecorder?.surface
            if (surface == null) {
                Log.e(TAG, "MediaRecorder surface is null")
                cleanup()
                stopSelf()
                return
            }

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "ScreenRecordServiceDisplay",
                finalRecordWidth,
                finalRecordHeight,
                dpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                surface,
                null,
                handler
            )

            mediaRecorder?.start()
            isRecording = true
            isPaused = false
            startTimeMillis = System.currentTimeMillis()
            pausedDurationMillis = 0L

            handler.post(timerRunnable)
            onStateChangedListener?.invoke(true, false)
            Log.i(TAG, "Recording started successfully. Output: ${outputFile?.absolutePath}")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start screen recording: ${e.message}", e)
            cleanup()
            stopSelf()
        }
    }

    fun pauseRecording() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isRecording && !isPaused) {
            try {
                mediaRecorder?.pause()
                isPaused = true
                pauseTimestampMillis = System.currentTimeMillis()
                onStateChangedListener?.invoke(true, true)
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                notificationManager.notify(NOTIFICATION_ID, buildNotification("Paused", isPaused = true))
            } catch (e: Exception) {
                Log.e(TAG, "Failed to pause recording: ${e.message}", e)
            }
        }
    }

    fun resumeRecording() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isRecording && isPaused) {
            try {
                mediaRecorder?.resume()
                isPaused = false
                pausedDurationMillis += (System.currentTimeMillis() - pauseTimestampMillis)
                handler.post(timerRunnable)
                onStateChangedListener?.invoke(true, false)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to resume recording: ${e.message}", e)
            }
        }
    }

    fun stopRecording(): File? {
        if (!isRecording) return null
        isRecording = false
        isPaused = false
        handler.removeCallbacks(timerRunnable)

        try {
            mediaRecorder?.apply {
                try {
                    stop()
                } catch (stopException: RuntimeException) {
                    Log.w(TAG, "Runtime exception stopping MediaRecorder: ${stopException.message}")
                }
                reset()
                release()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error cleaning up MediaRecorder: ${e.message}")
        } finally {
            mediaRecorder = null
        }

        try {
            virtualDisplay?.release()
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing virtual display: ${e.message}")
        } finally {
            virtualDisplay = null
        }

        try {
            mediaProjection?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping media projection: ${e.message}")
        } finally {
            mediaProjection = null
        }

        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {}
        removeRecordingControl()
        removeCameraOverlay()
        stopSelf()
        onStateChangedListener?.invoke(false, false)

        val resultFile = outputFile
        Log.i(TAG, "Recording finished. Result file: ${resultFile?.absolutePath} (size: ${resultFile?.length()} bytes)")
        return resultFile
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
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {}
        removeRecordingControl()
        removeCameraOverlay()
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    fun getRecordingDuration(): Long {
        return if (isRecording) {
            val activePauseMillis = if (isPaused) {
                System.currentTimeMillis() - pauseTimestampMillis
            } else {
                0L
            }
            System.currentTimeMillis() - startTimeMillis - pausedDurationMillis - activePauseMillis
        } else 0L
    }

    fun getIsRecording(): Boolean = isRecording
    fun getIsPaused(): Boolean = isPaused

    private fun showCameraOverlay() {
        if (isCameraShowing) return
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(this)) {
                Log.e(TAG, "Cannot show camera overlay: Overlay permission not granted")
                return
            }

            windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val previewView = PreviewView(this)
            previewView.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            
            // Circular clipping
            previewView.outlineProvider = object : android.view.ViewOutlineProvider() {
                override fun getOutline(view: View, outline: android.graphics.Outline) {
                    outline.setOval(0, 0, view.width, view.height)
                }
            }
            previewView.clipToOutline = true

            val size = (140 * resources.displayMetrics.density).toInt()
            val params = WindowManager.LayoutParams(
                size,
                size,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else
                    @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = 100
                y = 200
            }

            // Add touch listener for dragging
            previewView.setOnTouchListener(object : View.OnTouchListener {
                private var initialX: Int = 0
                private var initialY: Int = 0
                private var initialTouchX: Float = 0.0f
                private var initialTouchY: Float = 0.0f

                override fun onTouch(v: View, event: MotionEvent): Boolean {
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            initialX = params.x
                            initialY = params.y
                            initialTouchX = event.rawX
                            initialTouchY = event.rawY
                            return true
                        }
                        MotionEvent.ACTION_MOVE -> {
                            params.x = initialX + (event.rawX - initialTouchX).toInt()
                            params.y = initialY + (event.rawY - initialTouchY).toInt()
                            windowManager?.updateViewLayout(previewView, params)
                            return true
                        }
                    }
                    return false
                }
            })

            windowManager?.addView(previewView, params)
            cameraOverlayView = previewView
            isCameraShowing = true

            previewView.post {
                try {
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
                    cameraProviderFuture.addListener({
                        try {
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }

                            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
                            cameraProvider.unbindAll()
                            cameraProvider.bindToLifecycle(this, cameraSelector, preview)
                            Log.i(TAG, "Camera face cam overlay bound successfully to front camera")
                        } catch (exc: Exception) {
                            Log.e(TAG, "Camera binding failed for overlay: ${exc.message}")
                        }
                    }, ContextCompat.getMainExecutor(this))
                } catch (e: Exception) {
                    Log.e(TAG, "Error initializing ProcessCameraProvider for overlay: ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add camera overlay: ${e.message}")
            isCameraShowing = false
        }
    }

    private fun showRecordingControl() {
        if (controlOverlayView != null) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(this)) {
            Log.e(TAG, "Cannot show recording control: Overlay permission not granted")
            return
        }

        try {
            windowManager = windowManager ?: getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val root = FrameLayout(this)
            val params = WindowManager.LayoutParams(
                300,
                400,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                else
                    @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.END
                x = 24
                y = 180
            }

            val button = TextView(this).apply {
                text = "REC"
                setTextColor(Color.WHITE)
                textSize = 10f
                gravity = android.view.Gravity.CENTER
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.rgb(220, 38, 38))
                    setStroke(2, Color.WHITE)
                }
                setOnClickListener {
                    if (controlMenuView == null) showRecordingControlMenu(root) else removeRecordingControlMenu()
                }

                setOnTouchListener(object : View.OnTouchListener {
                    private var initialX = 0
                    private var initialY = 0
                    private var initialTouchX = 0f
                    private var initialTouchY = 0f
                    private var moved = false

                    override fun onTouch(view: View, event: MotionEvent): Boolean {
                        when (event.action) {
                            MotionEvent.ACTION_DOWN -> {
                                initialX = params.x
                                initialY = params.y
                                initialTouchX = event.rawX
                                initialTouchY = event.rawY
                                moved = false
                                return true
                            }
                            MotionEvent.ACTION_MOVE -> {
                                val deltaX = event.rawX - initialTouchX
                                val deltaY = event.rawY - initialTouchY
                                if (kotlin.math.abs(deltaX) > 8 || kotlin.math.abs(deltaY) > 8) {
                                    moved = true
                                }
                                params.x = initialX - deltaX.toInt()
                                params.y = initialY + deltaY.toInt()
                                windowManager?.updateViewLayout(root, params)
                                return true
                            }
                            MotionEvent.ACTION_UP -> {
                                if (!moved) view.performClick()
                                return true
                            }
                        }
                        return false
                    }
                })
            }
            root.addView(button, FrameLayout.LayoutParams(64, 64).apply {
                gravity = Gravity.TOP or Gravity.END
            })

            windowManager?.addView(root, params)
            controlOverlayView = root
        } catch (e: Exception) {
            Log.e(TAG, "Failed to show recording control: ${e.message}")
        }
    }

    private fun showRecordingControlMenu(root: FrameLayout) {
        val menu = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(12, 8, 12, 8)
            background = GradientDrawable().apply {
                setColor(Color.rgb(15, 23, 42))
                cornerRadius = 16f
                setStroke(1, Color.rgb(71, 85, 105))
            }
        }
        val pauseButton = TextView(this).apply {
            text = if (isPaused) "Resume" else "Pause"
            setTextColor(Color.WHITE)
            textSize = 15f
            gravity = android.view.Gravity.CENTER
            setPadding(24, 14, 24, 14)
            setOnClickListener {
                if (isPaused) resumeRecording() else pauseRecording()
                removeRecordingControlMenu()
            }
        }
        val stopButton = TextView(this).apply {
            text = "Stop"
            setTextColor(Color.rgb(248, 113, 113))
            textSize = 15f
            gravity = android.view.Gravity.CENTER
            setPadding(24, 14, 24, 14)
            setOnClickListener {
                val intent = Intent(this@ScreenRecordService, MainActivity::class.java).apply {
                    action = ACTION_REQUEST_STOP_FROM_OVERLAY
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                startActivity(intent)
                removeRecordingControlMenu()
            }
        }
        menu.addView(pauseButton)
        menu.addView(stopButton)
        val menuParams = FrameLayout.LayoutParams(-2, -2).apply {
            gravity = Gravity.TOP or Gravity.END
            topMargin = 72
        }
        root.addView(menu, menuParams)
        controlMenuView = menu
    }

    private fun removeRecordingControlMenu() {
        (controlOverlayView as? FrameLayout)?.removeView(controlMenuView)
        controlMenuView = null
    }

    private fun removeRecordingControl() {
        try {
            controlOverlayView?.let { windowManager?.removeView(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Error removing recording control: ${e.message}")
        } finally {
            controlOverlayView = null
            controlMenuView = null
        }
    }

    private fun removeCameraOverlay() {
        if (!isCameraShowing) return
        try {
            cameraOverlayView?.let { windowManager?.removeView(it) }
        } catch (e: Exception) {
            Log.e(TAG, "Error removing camera overlay: ${e.message}")
        } finally {
            cameraOverlayView = null
            isCameraShowing = false
        }
    }

    companion object {
        private const val TAG = "ScreenRecordService"
        const val CHANNEL_ID = "ScreenRecordingChannel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.screenrecorder.ACTION_START"
        const val ACTION_STOP = "com.screenrecorder.ACTION_STOP"
        const val ACTION_PAUSE = "com.screenrecorder.ACTION_PAUSE"
        const val ACTION_REQUEST_STOP_FROM_OVERLAY = "com.screenrecorder.ACTION_REQUEST_STOP_FROM_OVERLAY"
        const val ACTION_RESUME = "com.screenrecorder.ACTION_RESUME"

        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"
        const val EXTRA_WIDTH = "extra_width"
        const val EXTRA_HEIGHT = "extra_height"
        const val EXTRA_DPI = "extra_dpi"
        const val EXTRA_FPS = "extra_fps"
        const val EXTRA_BITRATE = "extra_bitrate"
        const val EXTRA_RECORD_AUDIO = "extra_record_audio"
        const val EXTRA_SHOW_CAMERA = "extra_show_camera"
    }
}
