// Ambient declarations for browser globals used by the app.
export {};

declare global {
  interface Window {
    anime?: any;
    __sing?: any;
    webkitAudioContext?: typeof AudioContext;
  }
}
