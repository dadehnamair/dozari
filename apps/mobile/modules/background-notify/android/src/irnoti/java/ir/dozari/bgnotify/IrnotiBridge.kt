package ir.dozari.bgnotify

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import ir.irnoti.sdk.Irnoti
import ir.irnoti.sdk.IrnotiConfig

/**
 * Real IRNoti bridge, compiled when `dozari.irnoti=true` (see build.gradle). Starts the SDK from the manifest meta-data that
 * plugins/withIrnoti.js writes; [ensure] is false when the build has no IRNoti app key.
 */
object IrnotiBridge {
  private const val TAG = "DozariIrnoti"
  @Volatile private var started = false

  /** Safe to call from any entry point (JS module, FCM service started cold by a push); Firebase is started first because the SDK reads its token. */
  @Synchronized
  fun ensure(context: Context): Boolean {
    if (started) return true
    val app = context.applicationContext
    if (!FcmInit.ensure(app)) { Log.w(TAG, "ensure: Firebase is not initialised (missing ir.dozari.fcm.* meta-data?)"); return false }
    val meta = try {
      app.packageManager.getApplicationInfo(app.packageName, PackageManager.GET_META_DATA).metaData
    } catch (e: Exception) {
      null
    } ?: return false
    val key = meta.getString("ir.dozari.irnoti.app_key") ?: run { Log.w(TAG, "ensure: no ir.dozari.irnoti.app_key in the manifest"); return false }
    val base = meta.getString("ir.dozari.irnoti.api_base")
    // The launcher icon doubles as the status-bar icon, as in Notifier.
    val icon = app.applicationInfo.icon
    Irnoti.init(app, if (base.isNullOrBlank()) IrnotiConfig(appKey = key, smallIcon = icon) else IrnotiConfig(appKey = key, smallIcon = icon, apiBase = base))
    started = true
    // The SDK swallows every error silently, so check the one step it depends on (the FCM token, which needs Google to be reachable) and report it.
    FirebaseMessaging.getInstance().token.addOnCompleteListener { t ->
      if (t.isSuccessful) Log.i(TAG, "FCM token ok (length=${t.result?.length ?: 0})") else Log.w(TAG, "FCM token FAILED: ${t.exception}")
    }
    Log.i(TAG, "ensure: Irnoti.init done, apiBase=${if (base.isNullOrBlank()) "(SDK default)" else base}")
    return true
  }

  fun isIrnotiMessage(data: Map<String, String>): Boolean = Irnoti.isIrnotiMessage(data)
  fun handleMessage(context: Context, data: Map<String, String>) = Irnoti.handleMessage(context, data)
  fun onNewToken(token: String) = Irnoti.onNewToken(token)
  fun identify(externalId: String) {
    Log.i(TAG, "identify called")
    Irnoti.identify(externalId)
  }
  fun logout() = Irnoti.logout()
}
