/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { Interaction } from 'discord.js';
import { ICommand, CommandMatchingType, ICommandFactory, CommandInteractionMainType } from '../models/Command';
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

export class CommandInteractionParser {
    private availableCommands: ICommand[];
    private botHelper: BotHelper;

    public constructor(commands: ICommand[]) {
        this.availableCommands = commands;
        this.botHelper = new BotHelper();
    }

    public getCommandsForInteractionInput(interaction: Interaction): ICommand[] {
        let commands: ICommandFactory[] = this.findInteractionCommands(interaction);

        let newCommands: ICommand[] = [];
        if (commands !== null) {
            for (let command of commands) {
                let newCommand: ICommand = command.makeCommand();
                newCommands.push(newCommand);
            }
        }

        return newCommands;        
    }

    private findInteractionCommands(inputInteraction: Interaction): ICommandFactory[] {
        let commands: ICommandFactory[] = [];

        for (let comm of this.availableCommands) {
            if (this.botHelper.hasCommandFactory(comm)) {
                if (comm.inputSettings && comm.inputSettings.interactionSettings && comm.inputSettings.interactionSettings.interactions) {
                    for (let interaction of comm.inputSettings.interactionSettings.interactions) {
                        let interactionAny: any = <any>inputInteraction;
                        if (interactionAny.commandName) {
                            if (interaction.applicationCommand && interaction.applicationCommand.name) {
                                if (interactionAny.commandName === interaction.applicationCommand.name) {
                                    commands.push(comm);
                                    continue;
                                }
                            }
                        }
                    }
                }
            }
        }

        return commands;
    }
}