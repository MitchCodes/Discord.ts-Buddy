import { SlashCommandBuilder } from '@discordjs/builders';
import { Interaction, Message } from 'discord.js';
import { CommandPermissionRequirementSettings } from './CommandPermission';
import { IDiscordBot } from './DiscordBot';

export enum CommandResultStatus {
    pending = 0,
    executing = 1,
    success = 2,
    error = 3,
}

export enum CommandInputContext {
    message = 0,
    interaction = 1,
    none = 2,
}

export interface ICommandResult {
    status: CommandResultStatus;
    error: Error;
    message: string;
    replyHandled: boolean;
}

export class CommandResult implements ICommandResult {
    public status: CommandResultStatus;
    public error: Error;
    public message: string;
    public replyHandled: boolean;

    public constructor() {
        this.status = CommandResultStatus.pending;
        this.replyHandled = false;
    }

    // tslint:disable-next-line:function-name
    public static buildSimpleError(errorString: string, errorObj: Error = null): CommandResult {
        let commandRes: CommandResult = new this();
        commandRes.status = CommandResultStatus.error;
        commandRes.message = errorString;

        if (errorObj === null) {
            commandRes.error = new Error(errorString);
        } else {
            commandRes.error = errorObj;
        }

        return commandRes;
    }
}

export interface ICommand {
    commandName: string;
    commandDescription: string;
    inputSettings: CommandInputSettings;
    setupInputSettings(bot: IDiscordBot): Promise<void>;
    execute(bot: IDiscordBot, input: CommandInput): Promise<ICommandResult>;
}

export interface ICommandFactory {
    makeCommand(): ICommand;
}

export enum CommandMatchingType {
    prefixedOneWord = 0,
    exactMatch = 1,
    startsWith = 2,
}

export class CommandInput {
    public inputContext: CommandInputContext;
    public msg: Message;
    public interaction: Interaction;

    public constructor(inputContext: CommandInputContext = CommandInputContext.message, msg: Message = null, interaction: Interaction = null) {
        this.inputContext = inputContext;
        this.msg = msg;
        this.interaction = interaction;
    }
}

export class CommandInputSettings {
    public messageMatchingSettings: CommandMatchingSettings;
    public interactionSettings: CommandInteractionSettings;

    public constructor(messageMatchSettings: CommandMatchingSettings = null, interactionSettings: CommandInteractionSettings) {
        this.messageMatchingSettings = messageMatchSettings;
        this.interactionSettings = interactionSettings;
    }
}

export class CommandMatchingSettings {
    public matchingType: CommandMatchingType = CommandMatchingType.prefixedOneWord;
    public commandMatchText: string;
    public commandPartDelimiter: string = ' ';
    public prefix: string = '!';

    public constructor(matchText: string = '', matchingType: CommandMatchingType = CommandMatchingType.prefixedOneWord, prefix: string = '', partDelimiter: string = '!') {
        this.commandMatchText = matchText;
        this.matchingType = matchingType;
        this.commandPartDelimiter = partDelimiter;
        this.prefix = prefix;
    }
}

export class CommandInteractionSettings {
    public interactions: CommandInteraction[] = [];
}

export enum CommandInteractionRegistrationContext {
    allGuilds = 0,
    guildList = 1,
    global = 2,
}

export enum CommandInteractionMainType {
    slashCommand = 0,
    contextUser = 1,
    contextMessage = 2,
}

export class CommandInteractionContextTypeSettings {
    public name: string;
}

export class CommandInteraction {
    public mainType: CommandInteractionMainType = CommandInteractionMainType.slashCommand;
    public registrationContext: CommandInteractionRegistrationContext = CommandInteractionRegistrationContext.allGuilds;
    public registrationGuilds: string[] = [];
    public builder: SlashCommandBuilder;
    public contextMenuMainTypeSettings: CommandInteractionContextTypeSettings = null;
    public overridePermissions: CommandPermissionRequirementSettings;

    public constructor(registrationContext: CommandInteractionRegistrationContext = CommandInteractionRegistrationContext.allGuilds, 
        builder: SlashCommandBuilder = null,
        registrationGuilds: string[] = [],
        overridePermissions: CommandPermissionRequirementSettings = null) {

        this.registrationContext = registrationContext;
        this.builder = builder;
        this.registrationGuilds = registrationGuilds;
        this.overridePermissions = overridePermissions;
    }
}

