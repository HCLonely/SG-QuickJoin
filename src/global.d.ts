declare function GM_addStyle(css: string): HTMLStyleElement;

declare function GM_registerMenuCommand(
  caption: string,
  onclick: () => void,
  accessKey?: string
): number;

declare function GM_unregisterMenuCommand(id: number): void;

declare function GM_getValue<T = unknown>(
  name: string,
  defaultValue?: T
): T;

declare function GM_setValue(name: string, value: unknown): void;
