package ir.dozari.bgnotify

import android.content.Context

/**
 * No-op IRNoti bridge, compiled by default (`dozari.irnoti` unset or false, see build.gradle) while the SDK cannot be fetched.
 * [ensure] is always false, so the JS side falls back to the direct FCM route and the WorkManager check.
 */
object IrnotiBridge {
  fun ensure(context: Context): Boolean = false
  fun isIrnotiMessage(data: Map<String, String>): Boolean = false
  fun handleMessage(context: Context, data: Map<String, String>) {}
  fun onNewToken(token: String) {}
  fun identify(externalId: String) {}
  fun logout() {}
}
