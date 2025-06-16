import { isNumber } from "./@internals/util";
import { HyLoggerException } from "./@internals/errors";
import { Dict, JsonValue, LOG_FORMAT, LOG_LEVEL } from "./types";
import { jsonSafeParser, jsonSafeStringify } from "./@internals/safe-json";


const _lD: Set<string> = new Set([
  "WARNING",
  "WARN",
  "DBG",
  "ERR",
  "INFO",
  "WRN",
  "INF",
  "ERROR",
  "LOG",
  "SUCCESS",
  "DEBUG",
  "FATAL",
  "TRACE",
  "FTL",
  "TRC",
  "SCC",
].map(item => [ item, item.toLowerCase() ]).flat());


export const possibleLevelDescriptors: readonly string[] = Object.freeze([ ..._lD.values() ]);


export function formatProperties(message: Dict<JsonValue>): string {
  const chunks: string[] = [];

  for(const prop in message) {
    if(!Object.prototype.hasOwnProperty.call(message, prop))
      continue;

    const v = message[prop];
    chunks.push(`${prop}=${typeof v === "string" ? ("\"" + v + "\"") : v}`);
  }

  return `[${chunks.join(" ")}]`;
}

export function parseProperties(message: string): Dict<JsonValue> {
  const str = normalizeTextEntry(message);

  if(str[0] !== "[" || str[str.length - 1] !== "]")
    return { };

  const props: Dict<JsonValue> = { };
  const inner = str.slice(1, -1).trim();

  const regexp = /(\w+)=(".*?"|'.*?'|[^\s]+)/g;
  let match: RegExpMatchArray | null = null;

  while((match = regexp.exec(inner)) != null) {
    const key = match[1];
    let val = match[2];

    if(
      (val[0] === "\"" && val[val.length - 1] === "\"") ||
      (val[0] === "'" && val[val.length - 1] === "'")
    ) {
      val = val.slice(1, -1);
    }

    if(isNumber(val)) {
      props[key] = Number(val);
    } else if(["true", "false"].includes(val.toLowerCase())) {
      props[key] = val.toLowerCase() === "true";
    } else if(val.toLowerCase() === "null") {
      props[key] = null;
    } else {
      props[key] = val;
    }
  }

  return props;
}


export function formatSLF(message: string, props?: Dict<JsonValue>): string {
  const properties = props ? formatProperties(props) : "";
  return `${message.trim()} ${properties}`;
}

export function parseSLF(msg: string): Dict<JsonValue> & { readonly message: string } {
  let message = "";
  let str = normalizeTextEntry(msg);

  for(let i = 0; i < str.length; i++) {
    if(str[i] === "[" && str[str.length - 1] === "]")
      break;

    message += str[i];
  }

  str = str.slice(message.length);
  let props: Dict<JsonValue> = {};

  if(str.length > 0 && str[0] === "[" && str[str.length - 1] === "]") {
    props = parseProperties(str);
  }

  return {
    ...props,
    message: message.trim(),
  };
}


export function parseText(message: string): string {
  return normalizeTextEntry(message);
}


export function parseJson<T = unknown>(message: string, strict: boolean = false): T {
  const parsed = jsonSafeParser<T>(message);

  if(parsed.isLeft()) {
    if(!strict)
      return { $message: message } as T;

    throw parsed.value;
  }

  return parsed.value;
}


export function stringifyLevel(level: LOG_LEVEL, s: boolean = false): string {
  const lmap: Record<LOG_LEVEL, string> = {
    [LOG_LEVEL.DEBUG]: "DEBUG",
    [LOG_LEVEL.ERROR]: "ERROR",
    [LOG_LEVEL.FATAL]: "FATAL",
    [LOG_LEVEL.INFO]: "INFO",
    [LOG_LEVEL.LOG]: "LOG",
    [LOG_LEVEL.SUCCESS]: "SUCCESS",
    [LOG_LEVEL.TRACE]: "TRACE",
    [LOG_LEVEL.WARNING]: "WARNING",
  };

  const fullLevel = lmap[level];

  if(!fullLevel) {
    throw new HyLoggerException(`Unknown level descriptor '${level}'`, "ERR_INVALID_ARGUMENT");
  }

  if(!s)
    return fullLevel;

  let short: string | null = null;

  switch(fullLevel.toUpperCase()) {
    case "WARNING":
      short = "WRN";
      break;
    case "INFORMATION":
    case "INFO":
      short = "INF";
      break;
    case "SUCCESS":
      short = "SCC";
      break;
    case "FATAL":
      short = "FTL";
      break;
    case "DEBUG":
      short = "DBG";
      break;
    case "ERROR":
      short = "ERR";
      break;
    case "TRACE":
      short = "TRC";
      break;
    case "LOG":
      short = "LOG";
      break;
    default:
      short = fullLevel.slice(0, 3);
  }

  return (short && _lD.has(short) ? short : fullLevel).toUpperCase();
}


export function normalizeTextEntry(message: string): string {
  const timestampRegex = String.raw`^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|` + // ISO 8601
                         String.raw`\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT|` +   // UTC format
                         String.raw`\d{10,})`;                                           // Numeric timestamp

  const levelRegex = String.raw`(\s*\[?(?:${[..._lD].join("|")})\]?)(\s*)`;

  return message
    .replace(new RegExp(`${timestampRegex}${levelRegex}`, "i"), "")
    .trim();
}


export function extractTimestamp(entry: string | LogEntry): Date {
  if(entry instanceof LogEntry)
    return new Date(entry.getTimestamp());

  const timestampRegex = String.raw`^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|` + // ISO 8601
                         String.raw`\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT|` +   // UTC format
                         String.raw`\d{10,})`;

  const match = new RegExp(timestampRegex, "i").exec(entry);

  if(!match) {
    throw new HyLoggerException("This entry does not appear to have a timestamp", "ERR_INVALID_ARGUMENT");
  }

  return new Date(match[0]);
}


export function extractLevel(entry: string | LogEntry): LOG_LEVEL {
  if(entry instanceof LogEntry)
    return entry.level;

  const match = new RegExp(`\\[?(${[..._lD].join("|")})\\]?`, "i").exec(entry);

  if(!match) {
    throw new HyLoggerException("This entry does not appear to have a level", "ERR_INVALID_ARGUMENT");
  }

  const lmap: Record<string, LOG_LEVEL> = {
    "DEBUG": LOG_LEVEL.DEBUG,
    "DBG": LOG_LEVEL.DEBUG,
    "ERROR": LOG_LEVEL.ERROR,
    "ERR": LOG_LEVEL.ERROR,
    "FATAL": LOG_LEVEL.FATAL,
    "FTL": LOG_LEVEL.FATAL,
    "INFO": LOG_LEVEL.INFO,
    "INF": LOG_LEVEL.INFO,
    "LOG": LOG_LEVEL.LOG,
    "SUCCESS": LOG_LEVEL.SUCCESS,
    "SCC": LOG_LEVEL.SUCCESS,
    "TRACE": LOG_LEVEL.TRACE,
    "TRC": LOG_LEVEL.TRACE,
    "WARNING": LOG_LEVEL.WARNING,
    "WARN": LOG_LEVEL.WARNING,
    "WRN": LOG_LEVEL.WARNING,
  };

  const level = lmap[match[1].toUpperCase()];

  if(!level) {
    throw new HyLoggerException(`The provided entry has a invalid level descriptor '${match[1]}'`, "ERR_INVALID_ARGUMENT");
  }

  return level;
}


export interface EntryOptions {
  timestampFormat?: "numeric" | "iso" | "utc";
  shorterLevel?: boolean;
  levelUnderBrackets?: boolean;
}


const defaultOptions: EntryOptions = {
  timestampFormat: "utc",
  shorterLevel: false,
  levelUnderBrackets: true,
};


class LogEntry {
  private readonly _timestamp: Date;

  public constructor(
    private _format: LOG_FORMAT = LOG_FORMAT.SLF,
    private _level: LOG_LEVEL = LOG_LEVEL.LOG,
    private _message?: string,
    private _props?: Dict<JsonValue>,
    private _options: EntryOptions = { ...defaultOptions } // eslint-disable-line comma-dangle
  ) {
    this._timestamp = new Date(Date.now());

    if(typeof _props !== "object") {
      this._props = { };
    }

    if(typeof _options !== "object") {
      this._options = { ...defaultOptions };
    } else {
      this._options = { ...defaultOptions, ..._options };
    }
  }

  public get format(): LOG_FORMAT {
    return this._format;
  }

  public set format(value: LOG_FORMAT) {
    this._format = value;
  }

  public get level(): LOG_LEVEL {
    return this._level;
  }

  public set level(value: LOG_LEVEL) {
    this._level = value;
  }

  public options(o?: Partial<EntryOptions>): this {
    this._options = { ...this._options, ...o };
    return this;
  }

  public getMessage<T = unknown>(): T {
    if(this._format === LOG_FORMAT.PROPERTIES)
      return this._props as T;

    return this._message as T;
  }

  public getTimestamp(): number;
  public getTimestamp(f: "utc" | "iso"): string;
  public getTimestamp(f?: "utc" | "iso"): string | number {
    if(!f || !["utc", "iso"].includes(f))
      return this._timestamp.getTime();

    if(f === "iso")
      return this._timestamp.toISOString();

    return this._timestamp.toUTCString();
  }

  public toString(): string {
    const tsMode = this._options.timestampFormat ?? "utc";
    const lb = this._options.levelUnderBrackets ?? true;
    const sl = this._options.shorterLevel ?? false;

    let str = tsMode === "numeric" ? `${this._timestamp.getTime()} ` : "";

    if(tsMode !== "numeric") {
      str += (tsMode === "iso" ? this._timestamp.toISOString() : this._timestamp.toUTCString());
      str += " ";
    }

    if(lb) {
      str += "[";
    }

    str += stringifyLevel(this._level, sl);

    if(lb) {
      str += "]";
    }

    str += " ";

    switch(this._format) {
      case LOG_FORMAT.TEXT:
        str += (this._message ?? "");
        break;
      case LOG_FORMAT.RAW:
        str += String(this._message);
        break;
      case LOG_FORMAT.PROPERTIES:
        str += formatProperties(this._props ?? {});
        break;
      case LOG_FORMAT.SLF:
        str += formatSLF(this._message ?? "", this._props);
        break;
      case LOG_FORMAT.JSON: {
        const json = jsonSafeStringify(this._message);

        if(json.isLeft()) {
          throw json.value;
        }

        str += json.value;
      } break;
    }

    return str;
  }
}

export default LogEntry;
