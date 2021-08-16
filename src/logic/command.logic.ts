/* eslint-disable @typescript-eslint/ban-types */
import { ICommand, CommandMatchingType, ICommandFactory } from '../models/Command';
import { BotHelper } from './helpers/bot.helper';

export class CommandMessageParser {
    private availableCommands: ICommand[];
    private botHelper: BotHelper;

    public constructor(commands: ICommand[]) {
        this.availableCommands = commands;
        this.botHelper = new BotHelper();
    }

    public getCommandsForMessageInput(inputCommand: string): ICommand[] {
        let commands: ICommandFactory[] = this.findRequestedCommands(inputCommand);

        let newCommands: ICommand[] = [];
        if (commands !== null) {
            for (let command of commands) {
                let newCommand: ICommand = command.makeCommand();
                newCommands.push(newCommand);
            }
        }

        return newCommands;        
    }

    public addAvailableCommand(passedAvailComm: ICommand): void {
        this.availableCommands.push(passedAvailComm);
    }

    private findRequestedCommands(rawInputCommand: string): ICommandFactory[] {
        let commands: ICommandFactory[] = [];

        for (let comm of this.availableCommands) {
            if (this.botHelper.hasCommandFactory(comm)) {
                if (comm.inputSettings && comm.inputSettings.messageMatchingSettings) {
                    let args: string[] = rawInputCommand.split(comm.inputSettings.messageMatchingSettings.commandPartDelimiter);
                    let commandName: string = args[0];
    
                    let prefixedCommandName = comm.inputSettings.messageMatchingSettings.prefix + comm.inputSettings.messageMatchingSettings.commandMatchText;
    
                    switch (comm.inputSettings.messageMatchingSettings.matchingType) {
                        case CommandMatchingType.exactMatch:
                            if (comm.inputSettings.messageMatchingSettings.commandMatchText === rawInputCommand) {
                                commands.push(comm);
                            }
                            break;
                        case CommandMatchingType.prefixedOneWord:
                            if (prefixedCommandName === commandName) {
                                commands.push(comm);
                            }
                            break;
                        case CommandMatchingType.startsWith:
                            if (rawInputCommand.startsWith(comm.inputSettings.messageMatchingSettings.prefix + comm.inputSettings.messageMatchingSettings.commandMatchText)) {
                                commands.push(comm);
                            }
                            break;
                    }  
                }
            }
        }
        
        return commands;
    }
}
