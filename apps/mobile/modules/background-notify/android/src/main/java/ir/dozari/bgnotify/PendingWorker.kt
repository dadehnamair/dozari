package ir.dozari.bgnotify

import android.content.Context
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
          // Same tag as the FCM push for this kind of event, so a notice that arrived both ways shows once.
          Notifier.show(context, if (id.startsWith("fr:")) "friend_request" else "inbox", item.getString("title"), item.getString("body"))
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
}
