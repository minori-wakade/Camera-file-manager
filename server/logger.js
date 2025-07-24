const fs = require('fs-extra');
const path = require('path');

async function injectGlobalLogger(cameraIp, saveDir) {
  const loggerCode = `
window.sendCommandToReceiver = function (message, cameraIp) {
  const payload = { message, cameraIp };
  fetch('http://localhost:7000/receive-command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => console.log('Command sent:', data))
    .catch(err => console.error('Command failed:', err));
};
  `.trim();

  const loggerPath = path.join(saveDir, 'global-logger.js');
  await fs.outputFile(loggerPath, loggerCode, 'utf8');
}

module.exports = { injectGlobalLogger };
