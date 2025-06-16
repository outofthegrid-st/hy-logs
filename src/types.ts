export const enum LOG_FORMAT {
  JSON = "json",
  RAW = "raw",
  TEXT = "text",
  PROPERTIES = "properties",
  SLF = "slf",
}


export const enum LOG_LEVEL {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  LOG = "LOG",
  TRACE = "TRACE",
  DEBUG = "DEBUG",
  SUCCESS = "SUCCESS",
  FATAL = "FATAL",
}


export type JsonValue = string | number | boolean | null;

export type Dict<T> = {
  [key: string]: T;
};
