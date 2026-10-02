/**
 * The build number of this app version. Raise it with every store release; the admin panel's «کمترین نسخه‌ی مجاز»
 * (`app.min_build`) is compared against it to force an update.
 */
export const APP_BUILD = 1;

/**
 * The market this build is shipped through, set when the build is made (`EXPO_PUBLIC_STORE=myket|bazaar|bale`). Empty for
 * development and web builds: those never ask for a store review.
 */
export const APP_STORE: 'myket' | 'bazaar' | 'bale' | null = (['myket', 'bazaar', 'bale'] as const).find((s) => s === process.env.EXPO_PUBLIC_STORE) ?? null;
