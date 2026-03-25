import { HttpApi } from "effect/unstable/httpapi";
import { HealthApi } from "./HealthApi";

export class Api extends HttpApi.make("greppa").add(HealthApi) {}
