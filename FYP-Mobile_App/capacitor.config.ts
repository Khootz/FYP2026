import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.fypmobile',
  appName: 'FYP Restaurant App',
  webDir: 'dist',
  server: {
    androidScheme: 'http',  // Use HTTP to match backend (change to 'https' for production)
    cleartext: true  // Allow HTTP requests (needed for local backend)
  },
  android: {
    allowMixedContent: true,  // Allow HTTP in HTTPS context
  }
};

export default config;
