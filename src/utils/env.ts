import fs from "fs";
import { join } from "path";

export namespace Env {
  export const Path = join(process.cwd(), `.env`);

  export const Cache: { [key: string]: string } = {};

  export class EnvItem {
    private Key;
    private Value;

    constructor(key: string, value: string) {
      this.Key = key;
      this.Value = value;
    }

    ToInt() {
      return Math.floor(this.ToNumber());
    }

    ToArray() {
      if (this.Value[0] !== "[" && this.Value[this.Value.length - 1] !== "]") {
        throw new Error(`item "${this.Key}" is not a valid array`);
      }

      return JSON.parse(this.Value);
    }

    ToObject() {
      if (this.Value[0] !== "{" && this.Value[this.Value.length - 1] !== "}") {
        throw new Error(`item "${this.Key}" is not a valid object`);
      }

      return JSON.parse(this.Value);
    }

    ToNumber() {
      if (isNaN(this.Value as any)) {
        throw new Error(`item "${this.Key}" is not a valid number`);
      }

      return Number(this.Value);
    }

    ToString() {
      return this.Value;
    }

    ToBoolean() {
      return this.Value == "true" || this.Value == "True";
    }
  }

  export function Get(key: string) {
    const item = Cache[key];

    return item ? new EnvItem(key, item) : undefined;
  }

  export function Set(key: string, value: any) {
    Cache[key] = ItemToString(value);

    return Get(key);
  }

  export function Save() {
    fs.writeFileSync(Path, ToString());
  }

  export function Default() {}

  export function Required(key: string) {
    const item = Get(key);

    if (!item) {
      throw new Error(`item "${key}" is required`);
    }

    return item;
  }

  export function Load() {
    if (!fs.existsSync(Path)) return;

    const content = fs.readFileSync(Path, "utf-8");

    content.split("\n").forEach((item) => {
      const trimmedItem = item.trim();
      if (!trimmedItem || trimmedItem.startsWith("#")) {
        return;
      }

      const [key, ...rest] = trimmedItem.split(":");

      if (key) {
        Cache[key] = rest.join(":");
        if (key === "DATABASE_URL") {
          process.env.DATABASE_URL = rest.join(":");
        }
      }
    });
  }

  export function ItemToString(item: any) {
    switch (typeof item) {
      case "object":
        return JSON.stringify(item);

      default:
        return `${item}`;
    }
  }

  export function ToString() {
    return Object.keys(Cache)
      .map((key) => `${key}=${Cache[key]}`)
      .join("\n");
  }

  Load();
}
