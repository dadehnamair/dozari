/* The worker the irnoti browser SDK registers (it looks for /irnoti-sw.js at the site root). It is the same worker as /sw.js
 * (PWA shell + our push handler), which itself pulls in the irnoti SDK code, so there is only ever one service worker for the
 * scope and the two registrations never replace each other. The app registers this file too (public/index.html). */
importScripts('/sw.js');
