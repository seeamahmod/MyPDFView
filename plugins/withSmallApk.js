// Shrinks the release APK without changing app behavior:
// - compresses native libraries (.so) and the JS bundle inside the APK
// - drops Fresco GIF/WebP decoders (the app never shows GIF or WebP images in RN;
//   Android decodes the WebP launcher icons itself)
const { withGradleProperties } = require('expo/config-plugins');

const PROPS = {
  'expo.useLegacyPackaging': 'true',
  'android.enableBundleCompression': 'true',
  'expo.gif.enabled': 'false',
  'expo.webp.enabled': 'false',
  'expo.webp.animated': 'false',
};

module.exports = function withSmallApk(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(PROPS)) {
      const item = cfg.modResults.find((p) => p.type === 'property' && p.key === key);
      if (item) item.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};
