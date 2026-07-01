const http = require("http");
const { config } = require("./config");
const { corsHeaders } = require("./security");
const { route } = require("./router");

function cors(req) {
  return corsHeaders(req, config);
}

function start() {
  const server = http.createServer((req, res) => {
    route(req, res, config, cors);
  });
  server.listen(config.port, config.host, () => {
    console.log(`RevenueFlow Cloud Sync running at http://${config.host}:${config.port}`);
  });
  return server;
}

if (require.main === module) start();

module.exports = { start };
