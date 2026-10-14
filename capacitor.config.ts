import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rgmcet.hostelportal',
  appName: 'RGM Hostel Portal',
  webDir: 'dist',
  android: {
    // Serve the webview over https://localhost so getUserMedia (face
    // recognition) runs in a secure context on Android.
    androidScheme: 'https',
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'automatic',
  },
  server: {
    // Served from bundled files; no remote server.
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#4f46e5',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    SystemBars: {
      // STYLE_DARK puts WHITE icons on the indigo status bar (match the
      // app's theme-color band). White status icons are correct on the dark
      // indigo background; the injected --safe-area-inset-* CSS variables feed
      // all --safe-top/--safe-bottom/--safe-left/--safe-right utilities.
      style: 'dark',
      hidden: false,
      insetsHandling: 'css',
    },
  },
};

export default config;