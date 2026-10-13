package ir.dozari.bgnotify

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.TimeUnit

/**
 * Background "anything new?" check without a push service (docs/logic/web-notifications.md, D232): WorkManager runs
 * [PendingWorker] about every 15–30 minutes (Android batches it with other work, so it is cheap on battery and needs no
 * foreground service or permanent notification). The worker asks `GET /me/pending-notices` and shows what it finds.
 * The JS side hands over the API address and the login token every time the app opens.
 */
class BackgroundNotifyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DozariBackgroundNotify")

    Function("schedule") { baseUrl: String, token: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      context.getSharedPreferences(PendingWorker.PREFS, Context.MODE_PRIVATE).edit()
        .putString("baseUrl", baseUrl.trimEnd('/'))
        .putString("token", token)
        .apply()
      val request = PeriodicWorkRequestBuilder<PendingWorker>(15, TimeUnit.MINUTES)
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .build()
      // KEEP: re-opening the app must not restart the timer (it would never fire for someone who opens the app often).
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(PendingWorker.WORK, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    Function("cancel") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      WorkManager.getInstance(context).cancelUniqueWork(PendingWorker.WORK)
      context.getSharedPreferences(PendingWorker.PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
  }
}
