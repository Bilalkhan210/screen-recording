package com.screenrecorder.recording

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
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object MediaStoreHelper {
    private const val TAG = "MediaStoreHelper"

    /**
     * Saves a temporary recorded video file to the device's public MediaStore (Movies/ScreenRecordings).
     * This ensures the video immediately appears in Google Photos, Samsung Gallery, and system media pickers.
     */
    fun saveVideoToGallery(context: Context, tempVideoFile: File, titlePrefix: String = "ScreenRecording"): Uri? {
        if (!tempVideoFile.exists() || tempVideoFile.length() == 0L) {
            Log.e(TAG, "Source video file is missing or empty: ${tempVideoFile.absolutePath}")
            return null
        }

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val displayName = "${titlePrefix}_$timestamp.mp4"
        val mimeType = "video/mp4"

        val resolver: ContentResolver = context.contentResolver
        val contentValues = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, mimeType)
            put(MediaStore.Video.Media.DATE_ADDED, System.currentTimeMillis() / 1000)
            put(MediaStore.Video.Media.DATE_MODIFIED, System.currentTimeMillis() / 1000)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/ScreenRecordings")
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
            itemUri = resolver.insert(collection, contentValues)
            if (itemUri == null) {
                Log.e(TAG, "Failed to create new MediaStore record")
                return null
            }

            resolver.openOutputStream(itemUri).use { outputStream ->
                if (outputStream == null) {
                    Log.e(TAG, "Failed to open output stream for URI: $itemUri")
                    return null
                }
                FileInputStream(tempVideoFile).use { inputStream ->
                    val buffer = ByteArray(64 * 1024)
                    var bytesRead: Int
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                    }
                    outputStream.flush()
                }
            }

            // Mark as complete on Android 10+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear()
                contentValues.put(MediaStore.Video.Media.IS_PENDING, 0)
                resolver.update(itemUri, contentValues, null, null)
            }

            Log.i(TAG, "Successfully exported screen recording to Gallery: $itemUri")
            return itemUri
        } catch (e: Exception) {
            Log.e(TAG, "Error saving video to MediaStore: ${e.message}", e)
            if (itemUri != null) {
                try {
                    resolver.delete(itemUri, null, null)
                } catch (cleanupEx: Exception) {
                    Log.w(TAG, "Failed to cleanup incomplete MediaStore entry: ${cleanupEx.message}")
                }
            }
            return null
        }
    }
}
