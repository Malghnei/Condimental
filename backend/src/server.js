import { createApp } from "./app/createApp.js";
import { getEnv } from "./config/env.js";

const env = getEnv();

if (env.hasMissingRequired) {
  console.warn(
    `Missing required env vars: ${env.missingRequired.join(", ")}. API calls may fail until configured.`
  );
}

const app = createApp({ env });

app.listen(env.port, () => {
  console.log(`Condimental backend listening on http://localhost:${env.port}`);
});
