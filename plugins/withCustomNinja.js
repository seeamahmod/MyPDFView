// Lets the Android native build use a newer ninja (1.12+) on Windows, where the
// SDK's bundled ninja 1.10 fails on object paths longer than 260 characters.
// Opt in with:  gradlew assembleRelease -PninjaPath=F:/tools/ninja.exe
//          or:  set NINJA_PATH=F:\tools\ninja.exe
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @mypdfview custom-ninja';
const SNIPPET = `
${MARKER}
def customNinja = findProperty('ninjaPath') ?: System.getenv('NINJA_PATH')
if (customNinja) {
    android.defaultConfig.externalNativeBuild.cmake.arguments("-DCMAKE_MAKE_PROGRAM=" + customNinja.replace('\\\\', '/'))
}
`;

module.exports = function withCustomNinja(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += SNIPPET;
    return cfg;
  });
};
