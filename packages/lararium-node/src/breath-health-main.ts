/**
 * breath-health-main — the vessel's healthcheck entry (`docker-compose.surface.yml`): one check, its exit Docker's verdict
 * (`breath-health`).
 */
import { breathHealthHere } from "./breath-health.js";

process.exitCode = await breathHealthHere();
