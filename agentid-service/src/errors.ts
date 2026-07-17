export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function assertPresent<T>(value: T | null | undefined, statusCode: number, code: string, message: string): T {
  if (value === null || value === undefined) throw new AppError(statusCode, code, message);
  return value;
}
