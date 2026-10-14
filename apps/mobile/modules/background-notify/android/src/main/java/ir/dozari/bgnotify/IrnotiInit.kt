package ir.dozari.bgnotify

import android.content.Context
import android.content.pm.PackageManager
import ir.irnoti.sdk.Irnoti
import ir.irnoti.sdk.IrnotiConfig

/** Starts the IRNoti SDK from the manifest meta-data that plugins/withIrnoti.js writes; false when the build has no IRNoti app key. */
object IrnotiInit {
  @Volatile private var started = false

  /** Safe to call from any entry point (JS module, FCM service started cold by a push); Firebase is started first because the SDK reads its token. */
  @Synchronized
  fun ensure(context: Context): Boolean {
    if (started) return true
    val app = context.applicationContext
    if (!FcmInit.ensure(app)) return false
    val meta = try {
      app.packageManager.getApplicationInfo(app.packageName, PackageManager.GET_META_DATA).metaData
    } catch (e: Exception) {
      null
    } ?: return false
    val key = meta.getString("ir.dozari.irnoti.app_key") ?: return false
    val base = meta.getString("ir.dozari.irnoti.api_base")
    // The launcher icon doubles as the status-bar icon, as in Notifier.
    val icon = app.applicationInfo.icon
    Irnoti.init(app, if (base.isNullOrBlank()) IrnotiConfig(appKey = key, smallIcon = icon) else IrnotiConfig(appKey = key, smallIcon = icon, apiBase = base))
    started = true
    return true
  }
}
