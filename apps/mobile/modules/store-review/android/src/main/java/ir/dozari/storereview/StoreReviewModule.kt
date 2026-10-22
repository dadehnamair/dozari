package ir.dozari.storereview

import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Opens CafeBazaar's own rating and comment form. Bazaar shows that form only for an ACTION_EDIT intent on the app's details URI,
 * addressed to the Bazaar package, which `Linking.openURL` cannot send. Returns false when Bazaar is not installed or refuses
 * the intent, so the caller can fall back to the web page.
 */
class StoreReviewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DozariStoreReview")

    Function("openBazaarReview") { packageName: String ->
      val context = appContext.currentActivity ?: appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val intent = Intent(Intent.ACTION_EDIT, Uri.parse("bazaar://details?id=$packageName")).apply {
        setPackage("com.farsitel.bazaar")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      try {
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
