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

export interface Vendor {
  id: string;
  name: string;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorCreate {
  name: string;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  notes?: string | null;
}

export type VendorUpdate = Partial<VendorCreate>;

export interface Proposal {
  id: string;
  vendorId: string;
  title: string;
  // Decimal fields serialize as strings on the wire (e.g. "1200.00") to avoid floating-point
  // rounding — parse with Number(...) only where arithmetic is actually needed for display.
  price: string | null;
  currency: string;
  summary: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalCreate {
  title: string;
  price?: string | number | null;
  currency?: string;
  summary: string;
  submittedAt?: string | null;
}

export type ProposalUpdate = Partial<ProposalCreate>;

export interface ComparisonRequest {
  proposalIds: string[];
}

export interface ComparisonResponse {
  summary: string;
}
