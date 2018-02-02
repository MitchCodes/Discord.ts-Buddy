import { ICommandFactory, ICommand, CommandMatchingSettings, CommandMatchingType } from '../models/Command';

export class CommandParser {
    private availableCommands: ICommandFactory[];
    private commandMatchingSettings: CommandMatchingSettings;

    public constructor(commandMatchingSettings: CommandMatchingSettings, passedAvailComms: ICommandFactory[]) {
        this.availableCommands = passedAvailComms;
        this.commandMatchingSettings = commandMatchingSettings;
    }

    public parseCommand(inputCommand: string): ICommand {
        let args: string[] = inputCommand.split(this.commandMatchingSettings.commandPartDelimiter);

        let command: ICommandFactory = this.findRequestedCommand(this.commandMatchingSettings, inputCommand, args);

        if (command !== null) {
            return command.makeCommand(args);
        }

        return null;        
    }

    public addAvailableCommand(passedAvailComm: ICommandFactory) {
        this.availableCommands.push(passedAvailComm);
    }

    private findRequestedCommand(matchingSettings: CommandMatchingSettings, rawInputCommand: string, args: string[]): ICommandFactory {

        switch (matchingSettings.matchingType) {
            case CommandMatchingType.exactMatch:
                for (let comm of this.availableCommands) {
                    if (comm.commandMatchText === rawInputCommand) {
                        return comm;
                    }
                }
                break;
            case CommandMatchingType.prefixedOneWord:
                let commandName: string = args[0];
                for (let comm of this.availableCommands) {
                    let prefixedCommandName = matchingSettings.prefix + comm.commandMatchText;
                    if (prefixedCommandName === commandName) {
                        return comm;
                    }
                }
                break;
            default:
                return null;
        }        

        return null;
    }
}
