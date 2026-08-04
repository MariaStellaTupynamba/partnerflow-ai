/**
 * Types shared between the PartnerFlow AI frontend and the FastAPI backend contract.
 *
 * These are hand-written to mirror the backend's Pydantic response schemas, which serialize as
 * camelCase JSON. Once the API surface grows, this package can be replaced by types generated
 * from the backend's OpenAPI schema (e.g. via `openapi-typescript`) — kept manual for now since
 * the contract is still small.
 */

export type HealthStatus = "ok" | "error";

export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  version: string;
  database: "connected" | "unavailable";
}

export interface UserPublic {
  id: string;
  email: string;
  isActive: boolean;
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ApiErrorResponse {
  detail: string;
}
