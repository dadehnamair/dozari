package ir.dozari.bgnotify

import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/**
 * Receives the server's FCM data messages ({title, body, tag}) and shows them, unless the app is in front. A rotated token is
 * sent to the server from here, with the API address and login token the JS side stored (PendingWorker.PREFS).
 */
class DozariMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    if (Notifier.inForeground(this)) return
    val d = message.data
    if (IrnotiBridge.isIrnotiMessage(d)) {
      if (IrnotiBridge.ensure(this)) IrnotiBridge.handleMessage(this, d)
      return
    }
    val body = d["body"] ?: return
    Notifier.show(this, d["tag"] ?: "dozari", d["title"] ?: "دوزاری", body)
  }

  override fun onNewToken(token: String) {
    // With IRNoti the SDK owns registration; the direct upload below is the fallback for builds without an IRNoti app key.
    if (IrnotiBridge.ensure(this)) {
      IrnotiBridge.onNewToken(token)
      return
    }
    val prefs = getSharedPreferences(PendingWorker.PREFS, Context.MODE_PRIVATE)
    prefs.edit().putString("fcmToken", token).apply()
    val base = prefs.getString("baseUrl", null) ?: return
    val auth = prefs.getString("token", null) ?: return
    Thread { upload(base, auth, token) }.start()
  }

  companion object {
    /** Tells the server this install's token; best effort, the next app open repeats it. */
    fun upload(base: String, auth: String, token: String) {
      try {
        val conn = URL("$base/push/fcm").openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.doOutput = true
        conn.connectTimeout = 15_000
        conn.readTimeout = 15_000
        conn.setRequestProperty("content-type", "application/json")
        conn.setRequestProperty("authorization", "Bearer $auth")
        conn.outputStream.use { it.write(JSONObject().put("token", token).toString().toByteArray()) }
        conn.responseCode
        conn.disconnect()
      } catch (e: Exception) {
        // ignored
      }
    }
  }
}
