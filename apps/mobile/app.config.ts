import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "NutriSnap",
  slug: "nutrisnap",
  scheme: "nutrisnap",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: process.env.IOS_BUNDLE_ID ?? "com.nutrisnap.app",
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription: "NutriSnap uses the camera to photograph your meals so it can estimate their nutrition.",
      NSPhotoLibraryUsageDescription: "NutriSnap lets you choose meal photos you've already taken.",
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? "com.nutrisnap.app",
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    // Location from photo EXIF is never needed; photos are re-encoded without it.
    blockedPermissions: ["android.permission.ACCESS_MEDIA_LOCATION", "android.permission.RECORD_AUDIO"],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "expo-splash-screen",
      { image: "./assets/splash-icon.png", imageWidth: 180, resizeMode: "contain", backgroundColor: "#F3F6F5", dark: { backgroundColor: "#15172B" } },
    ],
    [
      "expo-image-picker",
      {
        cameraPermission: "NutriSnap uses the camera to photograph your meals so it can estimate their nutrition.",
        photosPermission: "NutriSnap lets you choose meal photos you've already taken.",
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  updates: process.env.EAS_PROJECT_ID ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` } : undefined,
  runtimeVersion: { policy: "appVersion" },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
};

export default config;
