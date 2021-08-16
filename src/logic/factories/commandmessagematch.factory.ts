import { CommandMatchingSettings, CommandMatchingType } from '../../models/Command';

export interface ICommandMessageMatchFactory {
    createMatchingSettings(): CommandMatchingSettings;
}

export class PrefixedMessageMatchFactory implements ICommandMessageMatchFactory {
    private prefix: string;
    private commandPartDelimiter: string;
    private commandMatchingText: string;

    public constructor(prefix: string, commandPartDelimiter: string = ' ', commandMatchText: string = '') {
        this.prefix = prefix;
        this.commandPartDelimiter = commandPartDelimiter;
        this.commandMatchingText = commandMatchText;
    }

    public createMatchingSettings(): CommandMatchingSettings {
        let matchingSettings: CommandMatchingSettings = new CommandMatchingSettings();
        matchingSettings.prefix = this.prefix;
        matchingSettings.matchingType = CommandMatchingType.prefixedOneWord;
        matchingSettings.commandPartDelimiter = this.commandPartDelimiter;
        matchingSettings.commandMatchText = this.commandMatchingText;

        return matchingSettings;
    }
}

export class ExactMessageMatchFactory implements ICommandMessageMatchFactory {
    private commandMatchingText: string;

    public constructor(commandMatchText: string = '') {
        this.commandMatchingText = commandMatchText;
    }

    public createMatchingSettings(): CommandMatchingSettings {
        let matchingSettings: CommandMatchingSettings = new CommandMatchingSettings();
        matchingSettings.matchingType = CommandMatchingType.exactMatch;
        matchingSettings.commandMatchText = this.commandMatchingText;

        return matchingSettings;
    }
}

export class StartsWithMessageMatchFactory implements ICommandMessageMatchFactory {
    private prefix: string;
    private commandPartDelimiter: string;
    private commandMatchingText: string;

    public constructor(prefix: string, commandPartDelimiter: string = ' ', commandMatchText: string = '') {
        this.prefix = prefix;
        this.commandPartDelimiter = commandPartDelimiter;
        this.commandMatchingText = commandMatchText;
    }

    public createMatchingSettings(): CommandMatchingSettings {
        let matchingSettings: CommandMatchingSettings = new CommandMatchingSettings();
        matchingSettings.prefix = this.prefix;
        matchingSettings.matchingType = CommandMatchingType.startsWith;
        matchingSettings.commandPartDelimiter = this.commandPartDelimiter;
        matchingSettings.commandMatchText = this.commandMatchingText;

        return matchingSettings;
    }
}
