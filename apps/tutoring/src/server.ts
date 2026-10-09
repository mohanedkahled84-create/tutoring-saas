import "./instrument.js";
import { app } from "./app.js";
import { config } from "./shared/config/index.js";

const server = app.listen(config.port, () => {
  console.log(`[Tutoring SaaS Backend] Server running on port ${config.port}`);
});

// Configure server timeouts to accommodate large file uploads (up to 100MB) on variable mobile networks
server.requestTimeout = 900000; // 15 minutes (matches Railway proxy max stream limit)
server.headersTimeout = 120000; // 2 minutes
server.keepAliveTimeout = 65000; // 65 seconds

export default server;
