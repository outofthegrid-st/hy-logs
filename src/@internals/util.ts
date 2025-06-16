export function __assertType<T>(arg: unknown): asserts arg is T { void arg; }


export function isNumber(arg: unknown): boolean {
  if(typeof arg === "number")
    return true;

  if(typeof arg !== "string")
    return false;

  if((/^0x[0-9a-f]+$/i).test(arg))
    return true;

  return (/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/).test(arg);
}


export function parseBufferEncoding(payload: Buffer, encoding?: unknown): Buffer | string {
  return typeof encoding === "string" && Buffer.isEncoding(encoding) ?
    payload.toString(encoding) :
    payload;
}


const kindOf = (cache => (thing: unknown) => {
  const str = Object.prototype.toString.call(thing);
  return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));


export const kindOfTest = (type: string) => {
  type = type.toLowerCase();
  return (thing: unknown) => kindOf(thing) === type;
};


export function isPlainObject(val: any): boolean {
  if(Array.isArray(val)) return false;
  if(kindOf(val) !== "object" || typeof val !== "object") return false;

  const prototype = Object.getPrototypeOf(val);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in val) && !(Symbol.iterator in val);
}


export function isBase64(str: unknown): str is string {
  if(!str || typeof str !== "string") return false;

  try {
    // eslint-disable-next-line no-useless-escape
    const base64Regex = /^(?:[A-Za-z0-9+\/]{4})*?(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
    return (str.length % 4 === 0 && base64Regex.test(str)) || btoa(atob(str)) === str;
  } catch {
    return false;
  }
}


export function immediate<TArgs extends unknown[]>(callback: (...args: TArgs) => void, ...args: TArgs): { dispose(): void } & Disposable {
  const hasNativeMethod = typeof setImmediate === "function";
  const id = hasNativeMethod ? setImmediate(callback, ...args) : setTimeout(callback, 0, ...args);

  return {
    dispose() {
      if(hasNativeMethod) {
        clearImmediate(id as NodeJS.Immediate);
      } else {
        clearTimeout(id as NodeJS.Timeout);
      }
    },

    [Symbol.dispose]() {
      if(hasNativeMethod) {
        clearImmediate(id as NodeJS.Immediate);
      } else {
        clearTimeout(id as NodeJS.Timeout);
      }
    },
  };
}
