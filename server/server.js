const express = require('express');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const pathPosix = path.posix;
const cors = require('cors');
const beautifyJs = require('js-beautify').js;
const beautifyHtml = require('js-beautify').html;
const url = require('url');
const modifiers = require('./modifiers.js');
const { injectGlobalLogger } = require('./logger');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.static('camera-app'));
app.use(express.json());

function getUniqueSaveDir(baseDir, cameraIp) {
  let counter = 1;
  let saveDir;
  do {
    saveDir = path.join(baseDir, `${cameraIp}_${counter}`);
    counter++;
  } while (fs.existsSync(saveDir));
  return saveDir;
}

function modifyFileContent(filename, content, cameraIp) {
  const name = filename.toLowerCase();
  const ext = path.extname(name);

  let beautified;

  if (ext === '.js') {
    beautified = beautifyJs(content, { indent_size: 2 });
  } else if (ext === '.html' ) {
    beautified = beautifyHtml(content, { indent_size: 2 });
  } else {
    beautified = content;
  }
  if (modifiers[name]) {
    return modifiers[name](beautified, cameraIp);
  }
  return beautified;
}

async function fetchAllFiles(cameraIp, currentPath = '', saveDir) {
  const listUrl = `http://${cameraIp}/api/v1/file${currentPath}`;
  const response = await axios.get(listUrl);
  const items = response.data.data;

  for (const item of items) {
    const itemPath = pathPosix.join(currentPath, item.name);
    if (itemPath.startsWith('/help') || itemPath.includes('/help/')) {
    continue;
  }
    const ext = path.extname(item.name).toLowerCase();
    const isTextFile = ['.html', '.htm', '.css', '.js', '.json'].includes(ext);

    if (item.dir) {
      await fetchAllFiles(cameraIp, `/${itemPath}`, saveDir);
    } else {
      const fileUrl = isTextFile
        ? `http://${cameraIp}/api/v1/file${pathPosix.join('/', itemPath)}`
        : `http://${cameraIp}${pathPosix.join('/', itemPath)}`;

      const localPath = path.join(saveDir, itemPath);
      await fs.ensureDir(path.dirname(localPath));

      try {
        const responseType = isTextFile ? 'text' : 'arraybuffer';
        const fileResponse = await axios.get(fileUrl, { responseType });

        let data = fileResponse.data;

        if (isTextFile) {
          data = modifyFileContent(item.name, data, cameraIp);
          await fs.writeFile(localPath, data, 'utf8');
        } else {
          await fs.writeFile(localPath, Buffer.from(data));
        }
        // console.log(`Downloaded: ${fileUrl}`);
      } catch (err) {
        console.warn(`Failed to fetch ${fileUrl}:`, err.message);
      }
    }
  }
}

app.get('/download', async (req, res) => {
  const cameraIp = req.query.cameraIp;
  if (!cameraIp) {
    return res.status(400).send("cameraIp query parameter is required.");
  }
  console.log("Download Started for cameraIp:",cameraIp)
  try {
    const baseDir = path.join(__dirname, '..', 'camera-app');
    const saveDir = getUniqueSaveDir(baseDir, cameraIp);
    await fetchAllFiles(cameraIp, '', saveDir);
    await injectGlobalLogger(cameraIp, saveDir); 
    res.send(`All files from ${cameraIp} saved to ${saveDir}`);
    console.log(`All files from ${cameraIp} saved to ${saveDir}`)
  } catch (err) {
    console.error(`${err.message}`);
    res.status(500).send("Failed to fetch files from the camera.");
    console.log("Failed to fetch files from the camera.")
  }
});

app.use('/camera', async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const cameraIp = parsedUrl.query.cameraIp;
  if (!cameraIp) {
    return res.status(400).send('cameraIp query parameter is required.');
  }
  const cameraPath = parsedUrl.pathname.replace(/^\/camera/, '');
  delete parsedUrl.query.cameraIp;
  const queryString = new url.URLSearchParams(parsedUrl.query).toString();
  const finalUrl = `http://${cameraIp}${cameraPath}${queryString ? '?' + queryString : ''}`;
  try {
    const response = await axios.get(finalUrl, {
      responseType: 'text',
    });
    res.send(response.data);
  } catch (error) {
    console.error(`Proxy error:`, error.message);
    res.status(502).send('Error fetching from camera: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});