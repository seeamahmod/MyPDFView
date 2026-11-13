package expo.modules.devicepdfs

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Finds every PDF on the device through MediaStore and performs file operations
 * (overwrite / rename / delete) on them. Seeing other apps' PDFs requires
 * "All files access" (MANAGE_EXTERNAL_STORAGE) on Android 11+, or
 * READ_EXTERNAL_STORAGE on Android 10 and below.
 */
class DevicePdfsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("DevicePdfs")

    Function("hasAccess") { hasAccess() }

    Function("needsLegacyPermission") { Build.VERSION.SDK_INT < Build.VERSION_CODES.R }

    Function("openAccessSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val pkg = Uri.parse("package:${context.packageName}")
        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, pkg)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
        } catch (e: Exception) {
          context.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
      }
    }

    AsyncFunction("scan") {
      if (!hasAccess()) return@AsyncFunction emptyList<Map<String, Any?>>()
      val collection = MediaStore.Files.getContentUri("external")
      val projection = arrayOf(
        MediaStore.Files.FileColumns._ID,
        MediaStore.Files.FileColumns.DISPLAY_NAME,
        MediaStore.Files.FileColumns.SIZE,
        MediaStore.Files.FileColumns.DATE_MODIFIED,
        MediaStore.Files.FileColumns.DATA,
      )
      val selection = "${MediaStore.Files.FileColumns.MIME_TYPE} = ? OR ${MediaStore.Files.FileColumns.DISPLAY_NAME} LIKE ?"
      val args = arrayOf("application/pdf", "%.pdf")
      val ownDir = "/Android/data/${context.packageName}"
      val out = ArrayList<Map<String, Any?>>()
      context.contentResolver.query(collection, projection, selection, args, "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC")?.use { c ->
        val idCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
        val nameCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
        val sizeCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE)
        val dateCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED)
        val dataCol = c.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATA)
        while (c.moveToNext()) {
          val path = c.getString(dataCol) ?: continue
          if (path.contains(ownDir)) continue
          val size = c.getLong(sizeCol)
          if (size <= 0) continue
          val file = File(path)
          if (!file.exists()) continue
          val id = c.getLong(idCol)
          out.add(
            mapOf(
              "id" to id.toString(),
              "uri" to Uri.withAppendedPath(collection, id.toString()).toString(),
              "path" to path,
              "name" to (c.getString(nameCol) ?: file.name),
              "size" to size.toDouble(),
              "modified" to (c.getLong(dateCol) * 1000).toDouble(),
            )
          )
        }
      }
      out
    }

    /** Replaces the device file at [path] with the contents of the app file at [sourcePath]. */
    AsyncFunction("overwrite") { path: String, sourcePath: String ->
      requireAccess()
      val src = File(Uri.parse(sourcePath).path ?: sourcePath)
      val dest = File(path)
      src.inputStream().use { input -> dest.outputStream().use { output -> input.copyTo(output) } }
      rescan(dest.absolutePath)
      dest.length().toDouble()
    }

    /** Renames the device file and returns its new absolute path. */
    AsyncFunction("rename") { path: String, newName: String ->
      requireAccess()
      val file = File(path)
      val target = File(file.parentFile, newName)
      if (target.exists()) throw CodedException("ERR_EXISTS", "A file named $newName already exists in this folder", null)
      if (!file.renameTo(target)) throw CodedException("ERR_RENAME", "Could not rename the file", null)
      rescan(file.absolutePath)
      rescan(target.absolutePath)
      target.absolutePath
    }

    AsyncFunction("delete") { path: String ->
      requireAccess()
      val file = File(path)
      val ok = !file.exists() || file.delete()
      rescan(file.absolutePath)
      ok
    }
  }

  private fun hasAccess(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Environment.isExternalStorageManager()
    } else {
      ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
    }

  private fun requireAccess() {
    if (!hasAccess()) throw CodedException("ERR_NO_ACCESS", "PDFly Reader needs All files access to change files on your phone", null)
  }

  private fun rescan(path: String) {
    MediaScannerConnection.scanFile(context, arrayOf(path), null, null)
  }
}
