type ErrorDetails = Record<string, unknown>;

/** An expected failure that maps to an HTTP status and a stable error code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetails = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (code: string, message: string, details?: ErrorDetails) =>
  new ApiError(400, code, message, details);
export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what}을(를) 찾을 수 없습니다.`);
export const unauthorized = () => new ApiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
export const conflict = (code: string, message: string, details?: ErrorDetails) =>
  new ApiError(409, code, message, details);
