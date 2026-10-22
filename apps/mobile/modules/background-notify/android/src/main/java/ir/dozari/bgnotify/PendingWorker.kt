package ir.dozari.bgnotify

import android.content.Context
import android.util.Log
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
    private const val TAG = "DozariWorker"
  }

  override suspend fun doWork(): Result {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val baseUrl = prefs.getString("baseUrl", null)
    val token = prefs.getString("token", null)
    // Nothing handed over yet (or logged out): nothing to do, and no point retrying sooner.
    if (baseUrl == null || token == null) {
      Log.i(TAG, "check skipped: no base URL / login token handed over yet")
      return Result.success()
    }
    return try {
      val after = prefs.getLong("cursor", 0L)
      val conn = URL("$baseUrl/me/pending-notices?after=$after").openConnection() as HttpURLConnection
      conn.connectTimeout = 15_000
      conn.readTimeout = 15_000
      conn.setRequestProperty("authorization", "Bearer $token")
      try {
        // An expired token or a rate limit is not an error worth retrying with back-off; the next period tries again.
        if (conn.responseCode != 200) {
          Log.w(TAG, "check skipped: HTTP ${conn.responseCode}")
          return Result.success()
        }
        val body = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
        val seen = (prefs.getString("seen", "") ?: "").split('\n').filter { it.isNotEmpty() }.toMutableList()
        val items = body.getJSONArray("items")
        val foreground = Notifier.inForeground(context)
        val lastCheck = prefs.getLong("checkedLocal", 0L)
        var shown = 0
        var skipped = 0
        var held = 0
        for (i in 0 until items.length()) {
          val item = items.getJSONObject(i)
          val id = item.getString("id")
          if (seen.contains(id)) continue
          val tag = if (id.startsWith("fr:")) "friend_request" else "inbox"
          // The app is in front (it shows the news itself), or a push for this kind of event arrived since the last check: do not announce it again.
          if (foreground || prefs.getLong("pushed:$tag", 0L) > lastCheck) {
            seen.add(id)
            skipped += 1
            continue
          }
          // Only an event that was really posted counts as shown; with notifications not allowed it stays pending for a later check.
          if (Notifier.show(context, tag, item.getString("title"), item.getString("body"))) {
            seen.add(id)
            shown += 1
          } else {
            held += 1
          }
        }
        Log.i(TAG, "check done: items=${items.length()} shown=$shown skipped=$skipped held=$held foreground=$foreground")
        // With events held back (notifications not allowed) the cursor stays, so the next check lists them again.
        prefs.edit()
          .putLong("cursor", if (held == 0) body.getLong("now") else after)
          .putLong("checkedLocal", System.currentTimeMillis())
          .putString("seen", seen.takeLast(SEEN_LIMIT).joinToString("\n"))
          .apply()
        Result.success()
      } finally {
        conn.disconnect()
      }
    } catch (e: Exception) {
      // No network, a bad answer: the next period simply tries again.
      Log.w(TAG, "check failed: $e")
      Result.success()
    }
  }
}
