import pino, {
  type Bindings,
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

const defaultLoggerOptions: LoggerOptions = {
  base: undefined,
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
};

export function createLogger(
  destination?: DestinationStream,
  options: LoggerOptions = {},
): Logger {
  const mergedOptions = {
    ...defaultLoggerOptions,
    ...options,
  };

  if (destination) {
    return pino(mergedOptions, destination);
  }

  return pino(mergedOptions);
}

export const logger = createLogger();

type CreateRequestLoggerOptions = {
  logger?: Logger;
  bindings?: Bindings;
};

export function createRequestLogger(
  request: Request,
  options: CreateRequestLoggerOptions = {},
): Logger {
  const requestUrl = new URL(request.url);
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  return (options.logger ?? logger).child({
    requestId,
    method: request.method,
    pathname: requestUrl.pathname,
    ...options.bindings,
  });
}
