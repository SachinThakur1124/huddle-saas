import mongoose from "mongoose";
import { createApp } from "./app";
import { env } from "./config/env";

async function main() {
  await mongoose.connect(env.MONGO_URI);
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`huddle-backend listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", err);
  process.exit(1);
});
