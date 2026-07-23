// Local config plugin: throttle Gradle's resource usage so the build cannot
// overwhelm a low-memory host (notably `eas build --local` on WSL2, where two
// separate host-wide crashes were traced to Gradle memory pressure rather than
// concurrency).
//
// There is no committed `android/` directory, so prebuild regenerates
// `gradle.properties` from the RN template on every build; a hand-edit of that
// file is wiped before Gradle reads it. This plugin re-applies the settings
// declaratively during prebuild, so they are always in effect.
//
// Uses `withGradleProperties` from @expo/config-plugins (already an expo
// transitive dep) — no new npm dependency required.
const { withGradleProperties } = require('@expo/config-plugins');

// key -> value. `false`/`1`/`-Xmx2g` are all serialized as strings by Gradle.
const THROTTLE = {
  'org.gradle.jvmargs': '-Xmx2g -XX:MaxMetaspaceSize=512m',
  'org.gradle.workers.max': '1',
  'org.gradle.parallel': 'false',
};

function upsert(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === 'property' && item.key === key
  );
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', key, value });
  }
}

module.exports = function withGradleThrottle(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(THROTTLE)) {
      upsert(cfg.modResults, key, value);
    }
    return cfg;
  });
};
