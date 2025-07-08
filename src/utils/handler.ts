import { Collection, REST, Routes, type Client } from "discord.js";
import fs from "fs";
import { Event } from "bases/event";
import { Slash } from "bases/slash";
import { Prefix } from "bases/prefix";
import { Component } from "bases/component";
import { Env } from "./env";

export namespace Handler {
  export type Paths = {
    events?: string;
    slashes?: string;
    prefixes?: string;
    components?: string;
  };

  export type EventType = ReturnType<(typeof Event)["Create"]> & {
    path: string;
  };
  export type SlashType = ReturnType<(typeof Slash)["Create"]> & {
    path: string;
  };
  export type PrefixType = ReturnType<(typeof Prefix)["Create"]> & {
    path: string;
  };
  export type ComponentType = ReturnType<(typeof Component)["Create"]> & {
    path: string;
  };

  export const Cache = {
    events: new Collection<string, EventType>(),
    slashes: new Collection<string, SlashType>(),
    prefixes: new Collection<string, PrefixType>(),
    components: new Collection<string, ComponentType>(),
  };

  export function ReadDirRecursive(
    path: string,
    callback: (path: string, filename: string) => any
  ): any[] {
    return fs.readdirSync(path).map((filename) => {
      const filepath = `${path}/${filename}`;

      if (fs.statSync(filepath).isDirectory()) {
        return ReadDirRecursive(filepath, callback);
      }

      return callback(filepath, filename);
    });
  }

  export async function Load(path: string, cache: Collection<string, any>) {
    const promises: Promise<any>[] = [];

    ReadDirRecursive(path, (file) => {
      delete require.cache[require.resolve(file)];

      promises.push(
        import(file).then(({ default: data }) => {
          data.path = file;
          cache.set(data.name, data);

          return data;
        })
      );
    });

    return Promise.all(promises);
  }

  export async function Initialize(paths: Paths) {
    const awaitList: Promise<any>[] = [];

    if (paths.events) awaitList.push(Load(paths.events, Cache.events));
    if (paths.slashes) awaitList.push(Load(paths.slashes, Cache.slashes));
    if (paths.prefixes) awaitList.push(Load(paths.prefixes, Cache.prefixes));
    if (paths.components)
      awaitList.push(Load(paths.components, Cache.components));

    return Promise.all(awaitList);
  }

  export namespace Events {
    export function Bind(client: Client) {
      Unbind(client);

      Cache.events.forEach((event) => {
        if (event.once) {
          client.once(event.type, event.callback);
        } else {
          client.on(event.type, event.callback);
        }
      });
    }

    export function Unbind(client: Client) {
      Cache.events.forEach((event) => client.off(event.type, event.callback));
    }

    export async function Reload(client: Client, path: string) {
      Cache.events.clear();

      Unbind(client);

      (await Load(path, Cache.events)) as EventType[];

      Bind(client);
      return;
    }
  }

  export namespace Slashes {
    export const Rest = new REST().setToken(Env.Required("token").ToString());

    export async function Bind(client: Client) {
      if (client.isReady()) {
        await Rest.put(Routes.applicationCommands(client.user.id), {
          body: Cache.slashes.map((slash) => Slash.ToJSON(slash)),
        });
        return;
      }

      client.once("ready", async (client) => {
        await Rest.put(Routes.applicationCommands(client.user.id), {
          body: Cache.slashes.map((slash) => Slash.ToJSON(slash)),
        });
        return;
      });
    }

    export async function Reload(client: Client, path: string) {
      Cache.slashes.clear();

      (await Load(path, Cache.slashes)) as SlashType[];

      // @ts-ignore
      await Rest.put(Routes.applicationCommands(client.user.id), {
        // @ts-ignore
        body: Slash.ToJSON(slash.body),
      });
      return;
    }

    export function Find(name: string) {
      return Cache.slashes.find((slash) => slash.name === name);
    }
  }

  export namespace Prefixes {
    export async function Reload(path: string) {
      Cache.prefixes.clear();

      (await Load(path, Cache.prefixes)) as PrefixType[];
      return;
    }

    export function Find(name: string) {
      return Cache.prefixes.find(
        (prefix) => prefix.name === name || prefix.aliases.includes(name)
      );
    }
  }

  export namespace Components {
    export async function Reload(path: string) {
      Cache.components.clear();

      (await Load(path, Cache.components)) as ComponentType[];
      return;
    }

    export function Find(id: string) {
      return Cache.components.find((component) => component.id === id);
    }
  }
}
