export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = "internal_error",
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const asAppError = (error: unknown): AppError =>
  error instanceof AppError ? error : new AppError("Unexpected server error.");
