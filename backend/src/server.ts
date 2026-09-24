import { createServer } from "http";
import mongoose from "mongoose";
import { createApp } from "./app";
import { attachSockets } from "./sockets/index";
import { startWorkers } from "./jobs/worker";
import { env } from "./config/env";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const app = createApp();
  const httpServer = createServer(app);
  attachSockets(httpServer);
  startWorkers();
  httpServer.listen(env.PORT, () => {
    console.log(`huddle-backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
