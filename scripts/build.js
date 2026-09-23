const fs = require('fs');
const path = require('path');

const outputDir = path.join(__dirname, '..', 'dist');
const buildInfo = {
  name: 'self-hd',
  version: process.env.APP_VERSION || '1.0.0',
  commit: process.env.GIT_COMMIT || 'local',
  builtAt: new Date().toISOString()
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, 'build-info.json'),
  `${JSON.stringify(buildInfo, null, 2)}\n`
);

console.log(`Build artefact created at ${path.join(outputDir, 'build-info.json')}`);

