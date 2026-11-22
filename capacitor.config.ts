/** Capacitor packages the business-game build and keeps web safe areas under app control. */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.empiretycoon.game',
  appName: 'Empire Tycoon',
  webDir: 'apps/game/dist',
  android: { adjustMarginsForEdgeToEdge: 'auto' },
  ios: { contentInset: 'never' },
};

export default config;
