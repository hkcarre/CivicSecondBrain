// Preload script: loads .env.local before any module imports run.
// Uses override: true so it wins over empty shell env vars.
// Used as: node -r ./scripts/load-env.cjs -r tsx/cjs scripts/foo.ts
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), override: true });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });
