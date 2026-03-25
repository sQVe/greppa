import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

export class HealthApi extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("getHealth", "/api/health", {
    success: Schema.Struct({ status: Schema.Literal("ok") }),
  }),
) {}
