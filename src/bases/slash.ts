import { ApplicationCommandType, ApplicationIntegrationType, Attachment, AutocompleteInteraction, ChannelType, ChatInputCommandInteraction, ContextMenuCommandBuilder, InteractionContextType, MessageContextMenuCommandInteraction, SlashCommandBuilder, UserContextMenuCommandInteraction, type CacheType, type Channel, type CommandInteractionOption, type GuildMember, type PermissionResolvable, type Role, type User } from "discord.js";

export namespace Slash {
  export enum SlashType {
    Command = 'command',
    ContextUser = 'context_user',
    ContextMessage = 'context_message'
  };

  export enum Integration {
    Guild = 'guild',
    User = 'user'
  };

  export enum Context {
    Guild = 'guild',
    Bot = 'bot',
    DM = 'dm'
  };

  export type SlashOptions = {
    name: string;
    type: SlashType;
    integrations: Integration[];
    contexts: Context[];
    description: string;
    category: "Core" | "Dev" | "Info" | "Moderation" | "Utility"
    usage?: string;
    examples?: string[];
    cooldown?: number;
    nsfw?: boolean
    permissions?: {
      client?: PermissionResolvable[];
      author?: PermissionResolvable[];
    };

    args?: {
      [key: string]: OptionHandler<keyof OptionDict>;
    };

    defer?: boolean;
    ephemeral?: boolean;

    callback(interaction: Interaction, args: Callback<SlashOptions>): Promise<void>;
    autocomplete?(interaction: AutocompleteInteraction<CacheType>): Promise<void>;
  };

  export type OptionDict = {
    string: string;
    number: number;
    boolean: boolean;

    attachment: Attachment
    user: User;
    role: Role;
    member: GuildMember;
    channel: Channel;
    
    group: {};
    command: {};
  };

  export type OptionHandler<T extends keyof OptionDict> =     
      T extends "group" ? CommandOrGroupOption<T>
    : T extends "command" ? CommandOrGroupOption<T>
    : T extends "channel" ? ChannelOption<T>
    : T extends "number" ? NumberOption<T>
    : T extends "attachment" ? AttachmentOption<T>
    : StringOption<T>;

  export type StringOption<T extends keyof OptionDict> = {
    type: T;
    required?: boolean;
    description: string;
    choices?: Array<{ name: any; value: any }>;
    autocomplete?: boolean;
  };

  export type AttachmentOption<T extends keyof OptionDict> = {
    type: T;
    required?: boolean
    description: string
  };

  export type NumberOption<T extends keyof OptionDict> = {
    type: T;
    max?: number;
    min?: number;
    isInt?: boolean;
    required?: boolean;
    description: string;
  };

  export type ChannelOption<T extends keyof OptionDict> = {
    type: T;
    required?: boolean;
    description: string;
    channelType: keyof typeof ChannelType;
  };
  
  export type CommandOrGroupOption<T extends keyof OptionDict> = {
    type: T;
    description: string;

    body: {
      [key: string]: OptionHandler<keyof Omit<OptionDict, "command" | "group">>
    };
  };

  export type Callback<T extends SlashOptions> = {
    name: string;
    description: string;

   args: T["args"] extends Record<string, any> ? { [K in keyof T["args"]]: CallbackHandler<T["args"][K]> } : {};
  };

  export type CallbackHandler<T extends OptionHandler<keyof OptionDict>> = 
    T["type"] extends "command" ?
    // @ts-ignore
    { [K in keyof T["body"]]: CallbackHandler<T["body"][K]>; }
    // @ts-ignore
    : T["type"] extends "group" ?
    // @ts-ignore
    { [K in keyof T["body"]]: CallbackHandler<T["body"][K]> }
    // @ts-ignore
    : T["required"] extends true
    ? OptionDict[T["type"]]
    : OptionDict[T["type"]] | undefined;

  type Interaction = ChatInputCommandInteraction<CacheType> | MessageContextMenuCommandInteraction<CacheType> | UserContextMenuCommandInteraction<CacheType>;
  
  export function Create(options: SlashOptions) {
    options.permissions = { ...(options.permissions || {}) };

    return {
      name: options.name,
      type: options.type,
      integrations: options.integrations,
      contexts: options.contexts,
      description: options.description,
      category: options.category,
      usage: options.usage,
      examples: options.examples || [],
      cooldown: options.cooldown,
      nsfw: options.nsfw ?? false,
      permissions: {
        author: options.permissions.author || [],
        client: options.permissions.client || []
      },
      args: options.args || {},
      defer: !(options.defer == undefined ? true : !options.defer),
      ephemeral: !!options.ephemeral,
      callback: options.callback,
      autocomplete: options.autocomplete
    };
  };

  export function ToJSON(slash: SlashOptions) {
    if (slash.type === Slash.SlashType.Command) {
      const builder = new SlashCommandBuilder()
      .setName(slash.name)
      .setDescription(slash.description)
      .setIntegrationTypes(
        slash.integrations
        .map(type => {
          if (type === Integration.Guild) return ApplicationIntegrationType.GuildInstall;
          if (type === Integration.User) return ApplicationIntegrationType.UserInstall
        })
        .filter((type): type is ApplicationIntegrationType => type!== undefined)
      )
      .setContexts(
        slash.contexts
       .map(context => {
          if (context === Context.Guild) return InteractionContextType.Guild;
          if (context === Context.DM) return InteractionContextType.PrivateChannel;
          if (context === Context.Bot) return InteractionContextType.BotDM
        })
       .filter((context): context is InteractionContextType => context!== undefined)
      );

      for (const name in slash.args) {
        const body = slash.args[name];
        if (!body) continue;
        AppendToSlash(builder, { name, ...body });
      };

      const subcmd = Object.values(slash.args || {}).some(cmd => cmd.type === "command" || cmd.type === "group");

      if (!subcmd) {
        builder.addBooleanOption(option =>
          option.setName("incognito")
         .setDescription("Makes the response only visible to you")
        );
      }

      return builder.toJSON();
    } else if (slash.type === Slash.SlashType.ContextUser || slash.type === Slash.SlashType.ContextMessage) {
      const builder = new ContextMenuCommandBuilder()
      .setName(slash.name)
      .setType(slash.type === Slash.SlashType.ContextUser
        ? ApplicationCommandType.User
        : ApplicationCommandType.Message
      )
      .setIntegrationTypes(
        slash.integrations
        .map(type => {
          if (type === Integration.Guild) return ApplicationIntegrationType.GuildInstall;
          if (type === Integration.User) return ApplicationIntegrationType.UserInstall
        })
        .filter((type): type is ApplicationIntegrationType => type!== undefined)
      )
      .setContexts(
        slash.contexts
       .map(context => {
          if (context === Context.Guild) return InteractionContextType.Guild;
          if (context === Context.DM) return InteractionContextType.PrivateChannel;
          if (context === Context.Bot) return InteractionContextType.BotDM
        })
       .filter((context): context is InteractionContextType => context!== undefined)
      );

      return builder.toJSON();
    };
  };
    
  export function AppendToSlash(builder: SlashCommandBuilder, item: { name: string } & Slash.OptionHandler<keyof Slash.OptionDict>) {
    if(item.type == "command" || item.type == "group") {
      builder[item.type == "command" ? "addSubcommand" : "addSubcommandGroup"]((builder: any) => {
        for(const name in item.body) {
          const body = item.body[name];
          if(!body) continue;
          AppendToSlash(builder as any, { name, ...body });
        };

        return builder.setName(item.name).setDescription(item.description);
      });

      return builder;
    };

    switch(item.type) {
      case "channel": {
        builder.addChannelOption((option) => option.setName(item.name).setDescription(item.description).addChannelTypes(ChannelType[item.channelType] as any).setRequired(!!item.required))
        break;
      };
      case "member": {
        builder.addUserOption((option) => option.setName(item.name).setDescription(item.description).setRequired(!!item.required))
        break;
      };
      case "number": {
        if(item.isInt) builder.addNumberOption((option) => option.setName(item.name).setDescription(item.description).setMaxValue(item.max ?? Infinity).setMinValue(item.min ?? -Infinity).setRequired(!!item.required));
        else builder.addNumberOption((option) => option.setName(item.name).setDescription(item.description).setMaxValue(item.max ?? Infinity).setMinValue(item.min ?? -Infinity).setRequired(!!item.required));
        break;
      };
      case "role": {
        builder.addRoleOption((option) => option.setName(item.name).setDescription(item.description).setRequired(!!item.required))
        break;
      };
      case "string": {
        builder.addStringOption((option) => { option.setName(item.name).setDescription(item.description).setRequired(!!item.required).setAutocomplete(!!item.autocomplete); 
          if (item.choices && !item.autocomplete) {
            option.addChoices(item.choices);
          };
          return option;
        });
        break;
      };
      case "attachment": {
        builder.addAttachmentOption((option) => option.setName(item.name).setDescription(item.description).setRequired(!!item.required))
        break;
      };
      case "user": {
        builder.addUserOption((option) => option.setName(item.name).setDescription(item.description).setRequired(!!item.required))
        break;
      };
    };

    return builder;
  };
  
  export function GetSlashCommands(options: CommandInteractionOption<CacheType>[], body: { [key: string]: OptionHandler<keyof OptionDict> }) {
    return options.reduce((data, option) => {
      const item = body[option.name];

      if(!item) return data;

      switch(item.type) {
        case "boolean": {
          data[option.name] = !!option.value;
          break;
        };
        case "string": {
          data[option.name] = option.value;
          break;
        };
        case "attachment": {
          data[option.name] = option.attachment;
          break;
        };
        case "channel": {
          data[option.name] = option.channel;
          break;
        };
        case "role": {
          data[option.name] = option.role;
          break;
        };
        case "number": {
          data[option.name] = Number(option.value);
          break;
        };
        case "user": {
          data[option.name] = option.user;
          break;
        };
        case "member": {
          data[option.name] = option.member;
          break;
        };
        case "group":
        case "command": {
          data[option.name] = GetSlashCommands(option.options as any, item.body);
          break;
        };
      };

      return data;
    }, {} as { [key: string]: any });
  };
};