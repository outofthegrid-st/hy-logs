import { immediate } from "./util";


enum ERROR_CODE {
  ERR_UNKNOWN_ERROR = 101,
  ERR_INVALID_ARGUMENT = 102,
}


export class HyLoggerException extends Error {
  public override readonly name: string;
  public readonly code: number;

  public constructor(
    message?: string,
    code?: number | keyof typeof ERROR_CODE,
    public readonly context?: any // eslint-disable-line comma-dangle
  ) {
    super(message ?? "");

    if(typeof code !== "number") {
      const c = ERROR_CODE[code ?? "ERR_UNKNOWN_ERROR"] ?? ERROR_CODE.ERR_UNKNOWN_ERROR;
      this.code = -Math.abs(c);
    } else if(!code) {
      this.code = -ERROR_CODE.ERR_UNKNOWN_ERROR;
    } else {
      this.code = -Math.abs(code);
    }
  }

  public getCodeString(): string {
    return ERROR_CODE[-this.code] ?? "ERR_UNKNOWN_ERROR";
  }
}


export function onUnexpected(err: unknown): void {
  immediate(() => {
    if(err instanceof HyLoggerException) {
      err = new Error(`[${err.getCodeString()}] ${err.message}\n\n${err.stack}`);
    }

    throw err;
  });
}
