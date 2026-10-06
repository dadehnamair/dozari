package ir.dozari.appicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Switches the launcher icon between the activity-aliases that plugins/withGenderIcon.js adds to the manifest:
 * `MainActivityDefault` (the original hero), `MainActivityFemale`, `MainActivityAdult` and `MainActivityAdultFemale`.
 * Exactly one alias is enabled at a time; the target is enabled first so the app never has no launcher entry.
 * A no-op when the wanted icon is already the active one.
 */
class AppIconModule : Module() {
  private val aliases = mapOf(
    "default" to "MainActivityDefault",
    "female" to "MainActivityFemale",
    "adult" to "MainActivityAdult",
    "adultFemale" to "MainActivityAdultFemale",
  )

  private fun component(context: Context, name: String) = ComponentName(context.packageName, "ir.dozari.app.$name")

  private fun isEnabled(context: Context, component: ComponentName, enabledInManifest: Boolean): Boolean =
    when (context.packageManager.getComponentEnabledSetting(component)) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED -> false
      else -> enabledInManifest
    }

  private fun set(context: Context, component: ComponentName, enabled: Boolean) {
    context.packageManager.setComponentEnabledSetting(
      component,
      if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      PackageManager.DONT_KILL_APP,
    )
  }

  override fun definition() = ModuleDefinition {
    Name("DozariAppIcon")

    Function("setIcon") { variant: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val wanted = aliases[variant] ?: aliases.getValue("default")
      val target = component(context, wanted)
      // Only the default alias is enabled in the manifest.
      val alreadyOnly = aliases.values.all { name -> isEnabled(context, component(context, name), name == "MainActivityDefault") == (name == wanted) }
      if (alreadyOnly) return@Function
      set(context, target, true)
      aliases.values.filter { it != wanted }.forEach { set(context, component(context, it), false) }
    }
  }
}
