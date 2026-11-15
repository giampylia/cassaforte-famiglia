const https = require("https");
const fs = require("fs");
const path = require("path");

const baseUrl = "https://giampycash.lovable.app/assets/";
const targetDir = path.join(__dirname, "public", "assets");

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const downloaded = new Set();
const toDownload = [
  "index-DjHMptbn.js",
  "index-Cp_dnjcW.css",
  "PianoDeiConti-CfbDfT7L.js",
  "table-CMfWgxBX.js",
  "Budget-BPp9qWUX.js",
  "tabs-DtN1w0Np.js",
  "index-DXtt568w.js",
  "AvanzamentoBudget-CORlJ9Qw.js",
  "Liquidita-DuzrncnR.js",
  "jspdf.es.min-q0nMIQsP.js",
  "jspdf.plugin.autotable-CyVc7Jkq.js",
  "Auth-LKf5w8JL.js",
  "NotFound-CfCNpwbt.js",
  "Install-Cj8sVJu8.js"
];

function fetchFile(name) {
  if (downloaded.has(name)) return Promise.resolve();
  downloaded.add(name);
  const cleanName = name.replace(/^\.\//, "").replace(/^assets\//, "");
  const url = baseUrl + cleanName;
  const dest = path.join(targetDir, cleanName);

  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.warn("Failed " + cleanName + ": status " + res.statusCode);
        return resolve();
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(dest, buf);
        console.log("Downloaded " + cleanName + " (" + buf.length + " bytes)");

        if (cleanName.endsWith(".js")) {
          const str = buf.toString("utf8");
          const re = /["'`]([\.\/a-zA-Z0-9_\-]+\.(?:js|css))["'`]/g;
          let m;
          while ((m = re.exec(str)) !== null) {
            const found = m[1].replace(/^\.\//, "").replace(/^assets\//, "");
            if (found.includes("-") && (found.endsWith(".js") || found.endsWith(".css"))) {
              if (!downloaded.has(found) && !toDownload.includes(found)) {
                toDownload.push(found);
              }
            }
          }
        }
        resolve();
      });
    }).on("error", (err) => {
      console.error("Error " + cleanName + ": " + err.message);
      resolve();
    });
  });
}

async function run() {
  while (toDownload.length > 0) {
    const file = toDownload.shift();
    await fetchFile(file);
  }
  console.log("All downloads completed! Total downloaded files: " + downloaded.size);
}

run();
