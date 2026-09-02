export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR", details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: any) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: any) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", details?: any) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", details?: any) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: any) {
    super(message, 409, "CONFLICT", details);
  }
}
