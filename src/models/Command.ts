import { Message } from 'discord.js';
import { IDiscordBot } from './DiscordBot';

export enum CommandResultStatus {
    pending = 0,
    executing = 1,
    success = 2,
    error = 3,
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
}

export interface ICommand {
    commandName: string;
    commandDescription: string;
    execute(bot: IDiscordBot, msg: Message): Promise<ICommandResult>;
}

export interface ICommandFactory {
    commandMatchText: string;

    makeCommand(args: string[]): ICommand;
}

export enum CommandMatchingType {
    prefixedOneWord = 0,
    exactMatch = 1,
}

export class CommandMatchingSettings {
    public matchingType: CommandMatchingType = CommandMatchingType.prefixedOneWord;
    public commandPartDelimiter: string = ' ';
    public prefix: string = '!';
}