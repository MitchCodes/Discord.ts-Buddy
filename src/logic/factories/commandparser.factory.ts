import { ICommandFactory, CommandMatchingSettings, CommandMatchingType } from '../../models/Command';
import { CommandParser } from '../command.logic';

export interface ICommandParserFactory {
    createCommandParser(availableCommands: ICommandFactory[]): CommandParser;
}

export class PrefixedCommandParserFactory implements ICommandParserFactory {
    private prefix: string;
    private commandPartDelimiter: string;

    public constructor(prefix: string, commandPartDelimiter: string = ' ') {
        this.prefix = prefix;
        this.commandPartDelimiter = commandPartDelimiter;
    }

    public createCommandParser(availableCommands: ICommandFactory[] = []): CommandParser {
        let parserSettings: CommandMatchingSettings = new CommandMatchingSettings();
        parserSettings.prefix = this.prefix;
        parserSettings.matchingType = CommandMatchingType.prefixedOneWord;
        parserSettings.commandPartDelimiter = this.commandPartDelimiter;

        return new CommandParser(parserSettings, availableCommands);
    }
}

export class ExactCommandParserFactory implements ICommandParserFactory {
    public createCommandParser(availableCommands: ICommandFactory[] = []): CommandParser {
        let parserSettings: CommandMatchingSettings = new CommandMatchingSettings();
        parserSettings.matchingType = CommandMatchingType.exactMatch;

        return new CommandParser(parserSettings, availableCommands);
    }
}

export class StartsWithCommandParserFactory implements ICommandParserFactory {
    private prefix: string;
    private commandPartDelimiter: string;

    public constructor(prefix: string, commandPartDelimiter: string = ' ') {
        this.prefix = prefix;
        this.commandPartDelimiter = commandPartDelimiter;
    }

    public createCommandParser(availableCommands: ICommandFactory[] = []): CommandParser {
        let parserSettings: CommandMatchingSettings = new CommandMatchingSettings();
        parserSettings.prefix = this.prefix;
        parserSettings.matchingType = CommandMatchingType.startsWith;
        parserSettings.commandPartDelimiter = this.commandPartDelimiter;

        return new CommandParser(parserSettings, availableCommands);
    }
}
