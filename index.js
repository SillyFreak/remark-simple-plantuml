const fs = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');

const axios = require('axios');
const visit = require("unist-util-visit");
const plantumlEncoder = require("plantuml-encoder");

const pipe = promisify(pipeline);

const DEFAULT_OPTIONS = {
  // where the generated link points
  baseUrl: "https://www.plantuml.com/plantuml/png",
  // download; if omitted, no download is performed
  // this would normally be combined with something like baseUrl: "/static/plantuml"
  download: undefined,
  // download: { source: "https://www.plantuml.com/plantuml/png", destination: "./static/plantuml", extension: ".png" }
};

/**
 * Plugin for remark-js
 *
 * See details about plugin API:
 * https://github.com/unifiedjs/unified#plugin
 *
 * You can specify the endpoint of PlantUML with the option 'baseUrl'
 *
 * @param {Object} pluginOptions Remark plugin options.
 */
function remarkSimplePlantumlPlugin(pluginOptions) {
  const options = { ...DEFAULT_OPTIONS, ...pluginOptions };
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  let extension = "";

  let download;
  if (options.download) {
    const { source, destination, extension: ex } = options.download;
    if (ex !== undefined) {
      extension = ex;
    } else {
      let i = source.lastIndexOf("/");
      extension = `.${source.substring(i + 1)}`;
    }

    download = async (encoded) => {
      const filename = `${destination}/${encoded}${extension}`;

      if (fs.existsSync(filename)) {
        // console.log("found:", filename);
        return;
      }

      const response = await axios.get(`${source}/${encoded}`, { responseType: 'stream' });
      await pipe(response.data, fs.createWriteStream(filename));

      // console.log("downloaded:", filename);
    };
  } else {
    download = async (_encoded) => {
      // noop
    };
  }

  return async function transformer(syntaxTree) {
    const downloads = [];

    visit(syntaxTree, "code", node => {
      let { lang, value, meta } = node;
      if (!lang || !value || lang !== "plantuml") return;

      const encoded = plantumlEncoder.encode(value);

      downloads.push(download(encoded));

      node.type = "image";
      node.url = `${baseUrl}/${encoded}${extension}`;
      node.alt = meta;
      node.meta = undefined;
    });

    await Promise.all(downloads);

    return syntaxTree;
  };
}

module.exports = remarkSimplePlantumlPlugin;
