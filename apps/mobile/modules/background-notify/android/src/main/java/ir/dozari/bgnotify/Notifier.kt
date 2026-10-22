package ir.dozari.bgnotify

import android.Manifest
import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Shows the app's notifications. Both sources (the WorkManager check and FCM) use the same `tag`, so one event never shows twice. */
object Notifier {
  private const val CHANNEL = "dozari_news"

  /** True while one of our activities is in front: the app already shows the news itself then. */
  fun inForeground(context: Context): Boolean {
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    return manager.runningAppProcesses?.any { it.processName == context.packageName && it.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND } == true
  }

  /** True when the notification was posted; false when Android 13+ notifications are not allowed (callers must then not mark the event as shown). */
  fun show(context: Context, tag: String, title: String, text: String): Boolean {
    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
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
      .setOnlyAlertOnce(true)
      .setAutoCancel(true)
      .build()
    NotificationManagerCompat.from(context).notify(tag, 0, notification)
    return true
  }

  /** Remembers that a push for this kind of event arrived now, so the next background check does not announce the same event again. */
  fun notePush(context: Context, tag: String) {
    context.getSharedPreferences(PendingWorker.PREFS, Context.MODE_PRIVATE).edit().putLong("pushed:$tag", System.currentTimeMillis()).apply()
  }
}
