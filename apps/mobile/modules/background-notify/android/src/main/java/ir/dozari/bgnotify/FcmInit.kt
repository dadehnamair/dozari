package ir.dozari.bgnotify

import android.content.Context
import android.content.pm.PackageManager
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

/** Starts Firebase from the manifest meta-data that plugins/withFcm.js writes; false when the build has no Firebase identifiers. */
object FcmInit {
  fun ensure(context: Context): Boolean {
    if (FirebaseApp.getApps(context).isNotEmpty()) return true
    val meta = try {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA).metaData
    } catch (e: Exception) {
      null
    } ?: return false
    val projectId = meta.getString("ir.dozari.fcm.project_id") ?: return false
    val appId = meta.getString("ir.dozari.fcm.app_id") ?: return false
    val apiKey = meta.getString("ir.dozari.fcm.api_key") ?: return false
    val senderId = meta.get("ir.dozari.fcm.sender_id")?.toString() ?: return false
    return try {
      FirebaseApp.initializeApp(context, FirebaseOptions.Builder().setProjectId(projectId).setApplicationId(appId).setApiKey(apiKey).setGcmSenderId(senderId).build())
      true
    } catch (e: Exception) {
      false
    }
  }
}
