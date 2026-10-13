package ir.dozari.bgnotify

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** One background check: fetch the pending notices, show the ones this device has not shown yet, remember them. */
class PendingWorker(private val context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
  companion object {
    const val WORK = "dozari-pending-notices"
    const val PREFS = "dozari_bg_notify"
    private const val CHANNEL = "dozari_news"
    private const val SEEN_LIMIT = 200
  }

  override suspend fun doWork(): Result {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val baseUrl = prefs.getString("baseUrl", null)
    val token = prefs.getString("token", null)
    // Nothing handed over yet (or logged out): nothing to do, and no point retrying sooner.
    if (baseUrl == null || token == null) return Result.success()
    return try {
      val after = prefs.getLong("cursor", 0L)
      val conn = URL("$baseUrl/me/pending-notices?after=$after").openConnection() as HttpURLConnection
      conn.connectTimeout = 15_000
      conn.readTimeout = 15_000
      conn.setRequestProperty("authorization", "Bearer $token")
      try {
        // An expired token or a rate limit is not an error worth retrying with back-off; the next period tries again.
        if (conn.responseCode != 200) return Result.success()
        val body = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        val seen = (prefs.getString("seen", "") ?: "").split('\n').filter { it.isNotEmpty() }.toMutableList()
        val items = body.getJSONArray("items")
        for (i in 0 until items.length()) {
          val item = items.getJSONObject(i)
          val id = item.getString("id")
          if (seen.contains(id)) continue
          show(id, item.getString("title"), item.getString("body"))
          seen.add(id)
        }
        prefs.edit()
          .putLong("cursor", body.getLong("now"))
          .putString("seen", seen.takeLast(SEEN_LIMIT).joinToString("\n"))
          .apply()
        Result.success()
      } finally {
        conn.disconnect()
      }
    } catch (e: Exception) {
      // No network, a bad answer: the next period simply tries again.
      Result.success()
    }
  }

  private fun show(id: String, title: String, text: String) {
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel(CHANNEL, "اخبار دوزاری", NotificationManager.IMPORTANCE_DEFAULT))
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val tap = launch?.let { PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
    val notification = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setContentIntent(tap)
      .setAutoCancel(true)
      .build()
    NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
  }
}
