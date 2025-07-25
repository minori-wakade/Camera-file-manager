const beautifyJs = require('js-beautify').js;
const beautifyHtml = require('js-beautify').html;

module.exports = {
  'websockservice.js': (content, ip) => {
    const lines = beautifyJs(content).split('\n');
    const newLine = `    var h = "ws://${ip}:50501";`;
    let replaced = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('var h =') && lines[i].includes('window.location.protocol')) {
        lines[i] = newLine;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
    console.warn('websockservice.js: Expected `var h =` with protocol logic not found — no changes made.');
    }
    return lines.join('\n');
  },

  'wdk.min.js': (content, ip) => {
  const lines = beautifyJs(content).split('\n');
  let firstChangeMade = false;
  let secondChangeMade = false;
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes('t =') &&
      lines[i].includes('window.location.protocol') &&
      lines[i].includes('u.config.ipAddr') &&
      lines[i].includes('u.config.port') 
    ) {
      lines[i] = `        t = (0 === window.location.protocol.indexOf("https") ? "wss://" : "ws://") + "${ip}" + ":50502";`;
      firstChangeMade = true;
      break;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('}, t, i),') && lines[i].includes('u.received = 0')) {
      lines[i] = lines[i].replace(
        '}, t, i),',
        `}, t, i), u.config.ipAddr = "${ip}", u.config.path = "/api/v1/image",`
      );
      secondChangeMade = true;
      break;
    }
  }
  if (!firstChangeMade) {
    console.warn('wdk.min.js: WebSocket URL line not modified.');
  }

  if (!secondChangeMade) {
    console.warn('wdk.min.js: IP and path injection after `u.received = 0` not applied.');
  }
  return lines.join('\n');
},

  'settings.js': (content, ip) => {
  const target = 'ajax.post("/api/v1/file/user/settings.json"';
  const replacement = `ajax.post("http://localhost:5000/camera/api/v1/file/user/settings.json?cameraIp=${ip}"`;
  if (!content.includes(target)) {
    console.warn('settings.js: Could not modify ajax.post path.');
    return beautifyJs(content); 
  }
  return beautifyJs(content.split(target).join(replacement));
},

  'mscan-image-ex.js': (content, ip) => {
    let modified = false;
    let modifiedContent = content;

    const r1 = 'o.saveLastImageUrl = window.location.protocol + "//" + window.location.hostname + "/api/v1/image?format=png";';
    const r1Replacement = `o.saveLastImageUrl = window.location.protocol + "//" + "${ip}" + "/api/v1/image?format=png";`;
    if (modifiedContent.includes(r1)) {
      modifiedContent = modifiedContent.replace(r1, r1Replacement);
      modified = true;
    }

    const r2 = 'W.attr("href", window.location.protocol + "//" + T.targetIpWithPort + "/api/v1/image?format=png&cb=" + Math.random());';
    const r2Replacement = `W.off("click").on("click", function (e) {
    e.preventDefault();
    const imageUrl = window.location.protocol + "//" + "${ip}" + "/api/v1/image?format=png&decimate=1&cb=" + Math.random();
    fetch(imageUrl)
      .then(response => {
        if (!response.ok) throw new Error("Image fetch failed");
        return response.blob();
      })
      .then(blob => {
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = "image.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      })
      .catch(error => {
        alert("Download failed: " + error.message);
      });
      });`;
    if (modifiedContent.includes(r2)) {
      modifiedContent = modifiedContent.replace(r2, r2Replacement);
      modified = true;
    }

    const r3 = 'W.attr("href", window.location.protocol + "//" + T.targetIpWithPort + "/api/v1/image?format=png&cb=" + Math.random());';
    const r3Replacement = `W.attr("href", window.location.protocol + "//" + "${ip}" + "/api/v1/image?format=png&cb=" + Math.random());
    W.attr("download", "image.png");`;
    if (modifiedContent.includes(r3)) {
      modifiedContent = modifiedContent.replace(r3, r3Replacement);
      modified = true;
    }
    if (!modified) {
      console.warn('Could not modify mscan-image-ex.js');
    }
    return beautifyJs(modifiedContent);
  },

  'reader-setup-service.js': (content, ip) => {
    const funcName = 'getAppModes';
    const funcStart = `${funcName}: function`;
    const startIndex = content.indexOf(funcStart);
    if (startIndex === -1) {
    console.warn(`reader-setup-service.js: ${funcName} not found.`);
    return content;
  }
    let i = startIndex;
    let braceCount = 0;
    let foundStart = false;
    let endIndex = -1;

    while (i < content.length) {
      if (content[i] === '{') {
        braceCount++;
        foundStart = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          endIndex = i;
          break;
        }
      }
      i++;
    }

    if (endIndex === -1) {
      console.warn(`[WARN] Skipped reader-setup-service.js – ${funcName} incomplete.`);
      return content;
    }

    const before = content.slice(0, startIndex);
    const after = content.slice(endIndex + 1);
    const afterTrimmed = after.replace(/^,/, '');

    const newFunction = `getAppModes: function (callback) {
  if (O === null) {
    $.ajax({
      url: "http://localhost:5000/camera/shared/mscan/services/read-cycle-modes.json?cameraIp=${ip}",
      method: "GET",
      dataType: "json",
      success: function (data) {
        O = data;
        for (var i = 0; i < O.length; i++) {
          if (O[i].hasOwnProperty("template")) {
            O[i].template = O[i].template.join("\\n");
          }
        }
        for (var i = O.length - 1; i >= 0; i--) {
          if (
            O[i].hasOwnProperty("model") &&
            O[i].model.hasOwnProperty("hide") &&
            O[i].model.hide.hasOwnProperty("oemId") &&
            O[i].model.hide.oemId === $SETTINGS.brand.oemId
          ) {
            O.splice(i, 1);
          } else if (
            O[i].hasOwnProperty("model") &&
            O[i].model.hasOwnProperty("show") &&
            O[i].model.show.hasOwnProperty("oemId") &&
            O[i].model.show.oemId !== $SETTINGS.brand.oemId
          ) {
            O.splice(i, 1);
          }
        }
        callback(O);
      },
      error: function (xhr, status, error) {
        console.error("Failed to fetch read-cycle-modes.json:", status, error);
        callback([]);  
      }
    });
  } else {
    callback(O);
  }
},`;
    return before + newFunction + afterTrimmed;
  },

  'file-service.js': (content, ip) => {
  const lines = require('js-beautify').js(content).split('\n');
  const newLines = [];

  let insideSaveFile = false;
  let insideReadFile = false;
  let insideOnok = false;
  let braceCount = 0;

  let saveModified = false;
  let readModified = false;
  let onokModified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('saveFile: function(')) {
      insideSaveFile = true;
      braceCount = 0;
    }

    if (line.includes('readFile: function(')) {
      insideReadFile = true;
      braceCount = 0;
    }

    if (line.includes('onok: function(')) {
      insideOnok = true;
      braceCount = 0;
    }

    if (insideSaveFile || insideReadFile || insideOnok) {
      const openBraces = [...line].filter(c => c === '{').length;
      const closeBraces = [...line].filter(c => c === '}').length;
      braceCount += openBraces - closeBraces;
    }

    newLines.push(line);

    if (insideSaveFile && line.includes('g.saveLocal') && !saveModified) {
      newLines.push(`        sendCommandToReceiver("File saved: " + u, "${ip}");`);
      saveModified = true;
    }

    if (insideReadFile && line.includes('var a = n.data') && !readModified) {
      newLines.push(`        sendCommandToReceiver("File loaded: " + e.files[0].name, "${ip}");`);
      readModified = true;
    }

    if (insideOnok && line.includes('c.selectPage("setup")') && !onokModified) {
      newLines.push(`        sendCommandToReceiver("New setup launched", "${ip}");`);
      onokModified = true;
    }

    if ((insideSaveFile || insideReadFile || insideOnok) && braceCount <= 0) {
      insideSaveFile = false;
      insideReadFile = false;
      insideOnok = false;
    }
  }

  if (!saveModified) console.warn("⚠️ saveFile() not modified");
  if (!readModified) console.warn("⚠️ readFile() not modified");
  if (!onokModified) console.warn("⚠️ onok() not modified");

  return newLines.join('\n');
},

  'index.html': (content) => {
  const beautified = beautifyHtml(content);
  const insertion = `<script src="../global-logger.js"></script>\n`;
  const styleCloseIndex = beautified.indexOf('</style>');

  if (styleCloseIndex !== -1) {
    const insertAt = styleCloseIndex + '</style>'.length;
    return (
      beautified.slice(0, insertAt) +
      '\n' +
      insertion +
      beautified.slice(insertAt)
    );
  }

  return beautified;
},

'tour.js': (content, ip) => {
  const lines = content.split('\n');
  let inAjaxGet = false;
  let insertedStartSnippet = false;

  const startTourLine = `hopscotch.startTour(tour, $GET('TOUR_START_STEP', 0));`;

  const modifiedLines = lines.flatMap((line) => {
    const trimmed = line.trim();
    const result = [line];

    if (trimmed.includes('ajax.get') && trimmed.endsWith('{')) {
      inAjaxGet = true;
    }

    if (inAjaxGet && trimmed === '},') {
      inAjaxGet = false;
    }

    if (!insertedStartSnippet && inAjaxGet && trimmed === startTourLine) {
      insertedStartSnippet = true;
      result.push(
        `  if (window.angular) {`,
        `    var injector = angular.element(document.body).injector();`,
        `    if (injector) {`,
        `      sendCommandToReceiver("Guided tour started", "${ip}");`,
        `    }`,
        `  }`
      );
    }

    return result;
  });

  modifiedLines.push(
    ``,
    `hopscotch.listen('end', function() {`,
    `  if (window.angular) {`,
    `    var injector = angular.element(document.body).injector();`,
    `    if (injector) {`,
    `      var commandService = injector.get('commandService');`,
    `      sendCommandToReceiver("Guided tour ended", "${ip}");`,
    `    }`,
    `  }`,
    `});`
  );

  if (!insertedStartSnippet) {
    console.warn(`Couldnot modify tour.js`);
  }
  return modifiedLines.join('\n');
},

'mscan-settings-popover.js': (content, ip) => {
  const lines = beautifyJs(content).split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    newLines.push(line);

    const trimmed = line.trim();
    if (
      trimmed === 'h(), e.useBeeper = !e.useBeeper, l.putSetting("USE_BEEPER", e.useBeeper), e.beeperIcon = e.useBeeper ? "beeper-med" : "beeper-off-med"'
    ) {
      newLines.push(`    sendCommandToReceiver('Beeper is ' + (e.useBeeper ? 'ON' : 'OFF'), "${ip}");`);
    }

    if (trimmed === '}, 500, !1)') {
      newLines.push(
        `        var isOn = d.getParameter("K763.01").getValue() === 1;`,
        `        sendCommandToReceiver('Image Storage Option is ' + (isOn ? 'ON' : 'OFF'), "${ip}");`
      );
    }
  }

  return newLines.join('\n');
},

'app.js': (content, ip) => {
  const lines = beautifyJs(content).split('\n');
  const newLines = [];

  let insideSFunction = false;
  let insideLanguageBlock = false;
  let insideOpenHelp = false;

  let braceCount = 0;

  let replacedUnload = false;
  let injectedCmdsLog = false;
  let handledLanguageBlock = false;
  let helpJaReplaced = false;
  let helpEnReplaced = false;

  // Remove help directory block
  const joined = lines.join('\n');
  const cleaned = joined.replace(
    /,\s*s\.getDirectory\(["']\/help["'],\s*function\(t\)\s*{\s*e\.showHelp\s*=\s*t\.length\s*>\s*0\s*}\),/g,
    ','
  );
  if (cleaned === joined) {
    console.warn("app.js: Help directory block removal not detected.");
  } else {
    removedHelpDirectory = true;
  }

  const modifiedLines = cleaned.split('\n');
  for (let i = 0; i < modifiedLines.length; i++) {
    let line = modifiedLines[i];

    //Replace window.onunload with window.onbeforeunload
    if (line.includes('window.onunload = function()')) {
      line = line.replace('window.onunload = function()', 'window.onbeforeunload = function()');
      replacedUnload = true;
    }
    if (line.includes('function s(t, a)')) {
      insideSFunction = true;
      braceCount = 0;
    }

    if (insideSFunction) {
      const open = [...line].filter(c => c === '{').length;
      const close = [...line].filter(c => c === '}').length;
      braceCount += open - close;

      newLines.push(line);

      //Inject sendCommandToReceiver block
      if (line.includes('console.log(e.cmdsAdded + " parameter editors added")')) {
        injectedCmdsLog = true;
        newLines.push(
          `        (function() {`,
          `          var injector = angular.element(document.body).injector();`,
          `          if (injector) {`,
          `            var message = e.cmdsAdded + " parameter editors added";`,
          `            sendCommandToReceiver(message, "${ip}");`,
          `          }`,
          `        })();`
        );
        continue;
      }

      if (braceCount <= 0) {
        insideSFunction = false;
      }

      continue;
    }

     // Handle language block
    if (line.includes('a.getJson("WebLink/language-list.json"')) {
      insideLanguageBlock = true;
      braceCount = 0;
      continue;
    }

    if (insideLanguageBlock) {
      braceCount += [...line].filter(c => c === '{').length;
      braceCount -= [...line].filter(c => c === '}').length;

      if (braceCount <= 0) {
        insideLanguageBlock = false;
        handledLanguageBlock = true;
        newLines.push(
          `    },$.ajax({`,
          `      url: "http://localhost:5000/camera/WebLink/language-list.json?cameraIp=${ip}",`,
          `      type: "GET",`,
          `      dataType: "json",`,
          `      success: function(a) {`,
          `        e.$apply(function() {`,
          `          e.language.languages = a.languages;`,
          `          if (e.language.languages) {`,
          `            e.language.selectedLang = e.language.languages[0];`,
          `            var r = t.use();`,
          `            for (var i = 0; i < e.language.languages.length; i++) {`,
          `              if (e.language.languages[i].id === r) {`,
          `                e.language.selectedLang = e.language.languages[i];`,
          `                break;`,
          `              }`,
          `            }`,
          `            e.language.defaultReaderLang = $GET("LANGUAGE") === r;`,
          `          }`,
          `        });`,
          `      },`,
          `      error: function(xhr, status, error) {`,
          `        console.error("Failed to load language-list.json:", error);`,
          `      }`
        );
      }
      continue;
    }

    //Replace help URLs
    if (line.includes('e.openHelp = function(')) {
      insideOpenHelp = true;
    }
    if (insideOpenHelp) {
      if (line.includes('window.open("/help/ja/index.htm"')) {
        line = `                window.open("http://${ip}/help/ja/index.htm", "WebLink Help", "_blank");`;
        helpJaReplaced = true;
      } else if (line.includes('window.open("/help/en/index.htm"')) {
        line = `                window.open("http://${ip}/help/en/index.htm", "WebLink Help", "_blank");`;
        helpEnReplaced = true;
      }
    }
    newLines.push(line);
  }
  if (!replacedUnload) {
    console.warn("app.js: Did not replace 'window.onunload' with 'window.onbeforeunload'.");
  }
  if (!injectedCmdsLog) {
    console.warn('app.js: Did not inject sendCommandToReceiver after "parameter editors added" log.');
  }
  if (!handledLanguageBlock) {
    console.warn("app.js: Did not insert override for language-list.json.");
  }
  if (!helpJaReplaced) console.warn("app.js: Did not update help JA URL.");
  if (!helpEnReplaced) console.warn("app.js: Did not update help EN URL.");
  return newLines.join('\n');
},

'mscan-log.js': (content, ip) => {
  const beautified = beautifyJs(content);
  const oldUrl = 'r.get("/api/v1/file/device/commands.json" + CACHE_BUST)';
  const newUrl = `r.get("http://localhost:5000/camera/api/v1/file/device/commands.json?cameraIp=${ip}" + CACHE_BUST)`;
  if (!beautified.includes(oldUrl)) {
    console.warn(`Couldnot modify mscan-log.js`);
    return beautified; 
  }
  return beautified.replace(oldUrl, newUrl);
},
};