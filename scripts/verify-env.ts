import "dotenv/config";
import { validateServerEnv } from "../src/lib/env";

validateServerEnv();
console.log("Environment OK");
