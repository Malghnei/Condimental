export class HttpError extends Error {
  constructor({
    statusCode,
    publicMessage,
    code = "INTERNAL_ERROR",
    cause = null
  }) {
    super(publicMessage, cause ? { cause } : undefined);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.publicMessage = publicMessage;
    this.code = code;
  }
}

export function isHttpError(error) {
  return error instanceof HttpError;
}
