const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withReactNativeMaps = (config) => {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');

      if (fs.existsSync(podfilePath)) {
        let podfileContent = fs.readFileSync(podfilePath, 'utf8');
        podfileContent = podfileContent.replace(
          /pod 'react-native-google-maps'/g,
          "pod 'react-native-maps'"
        );
        fs.writeFileSync(podfilePath, podfileContent);
        console.log('✅ Fixed pod name: react-native-google-maps → react-native-maps');
      }

      return config;
    },
  ]);
};

module.exports = withReactNativeMaps;