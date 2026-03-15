import {
  RUNTIME_MESSAGE_SCHEMA,
  RUNTIME_MESSAGE_SIGNATURE
} from "../../../../../packages/shared/src/types/runtimeMessages";

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function hasRuntimeEnvelope(value: Record<string, unknown>): boolean {
  return value.signature === RUNTIME_MESSAGE_SIGNATURE && value.schema === RUNTIME_MESSAGE_SCHEMA;
}

export function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}
