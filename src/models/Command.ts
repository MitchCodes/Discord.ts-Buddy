import { Message } from 'discord.js';
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
    execute(bot: IDiscordBot, msg: Message): Promise<ICommandResult>;
}

export interface ICommandFactory {
    makeCommand(): ICommand;
}

export enum CommandMatchingType {
    prefixedOneWord = 0,
    exactMatch = 1,
    startsWith = 2,
}

export class CommandInputSettings {
    public messageMatchingSettings: CommandMatchingSettings;

    public constructor(messageMatchSettings: CommandMatchingSettings = null) {
        this.messageMatchingSettings = messageMatchSettings;
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
