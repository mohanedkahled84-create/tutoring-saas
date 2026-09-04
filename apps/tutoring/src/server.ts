import { app } from "./app.js";
import { config } from "./shared/config/index.js";

const server = app.listen(config.port, () => {
  console.log(`[Tutoring SaaS Backend] Server running on port ${config.port}`);
});

export default server;
