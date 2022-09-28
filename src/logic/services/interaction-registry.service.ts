/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApplicationCommand, ApplicationCommandType, Client, ContextMenuCommandBuilder, Guild, GuildResolvable, RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import { ILogger } from "tsdatautils-core";
import { BasicDictionary } from "../../models/BasicDictionary";
import { CommandInteraction, CommandInteractionMainType, CommandInteractionRegistrationContext, ICommand } from "../../models/Command";
import { CommandPermissionRequirementSettings } from "../../models/CommandPermission";
import { BotHelper } from "../helpers/bot.helper";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

export class InteractionRegistrationCommandContext {
    public command: ICommand;
    public commandPermissions: CommandPermissionRequirementSettings;
    public interaction: CommandInteraction;
    public discordApplicationCommand: ApplicationCommand<{ guild: GuildResolvable; }>;

    public constructor(command: ICommand, interaction: CommandInteraction, commandPermissions: CommandPermissionRequirementSettings = null) {
        this.command = command;
        this.interaction = interaction;
        this.commandPermissions = commandPermissions;
    }
}

export class InteractionRegistryService {
    private logger: ILogger = null;
    private shouldRegisterCallback: (context: CommandInteractionRegistrationContext, interactions: InteractionRegistrationCommandContext[], guildId: string) => Promise<boolean> = null;
    private registeredInteractionsCallback: (context: CommandInteractionRegistrationContext, interactions: InteractionRegistrationCommandContext[], guildId: string) => Promise<void> = null;

    public constructor(logger: ILogger, 
                            shouldRegisterCallback: (context: CommandInteractionRegistrationContext, interactions: InteractionRegistrationCommandContext[], guildId: string) => Promise<boolean> = null,
                            registeredInteractionsCallback: (context: CommandInteractionRegistrationContext, interactions: InteractionRegistrationCommandContext[], guildId: string) => Promise<void> = null
                        ) {
        this.logger = logger;
        this.shouldRegisterCallback = shouldRegisterCallback;
        this.registeredInteractionsCallback = registeredInteractionsCallback;
    }

    public async registerInteractions(client: Client, clientId: string, token: string, allGuilds: Guild[], commands: ICommand[]): Promise<void> {
        let globalInteractions: InteractionRegistrationCommandContext[] = [];
        let guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]> = {};
        let allInteractions: InteractionRegistrationCommandContext[];

        // Create the context models 
        this.createInteractionCommandContexts(allGuilds, commands, globalInteractions, guildInteractions);
        allInteractions = this.getAllInteractionCommandContexts(globalInteractions, guildInteractions);

        if (allInteractions && allInteractions.length > 0) {
            // Pre-registration calculation
            await this.preRegistrationCalculation(globalInteractions, guildInteractions, allInteractions);

            // Register the slash commands with Discord
            await this.registerInteractionsInApi(clientId, token, globalInteractions, guildInteractions);

            await this.postRegistration(client, allGuilds, globalInteractions, guildInteractions);
        }
    }

    private createInteractionCommandContexts(allGuilds: Guild[], commands: ICommand[], globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>): void {
        let botHelper: BotHelper = new BotHelper();

        for (let command of commands) {
            if (command.inputSettings?.interactionSettings?.interactions) {
                let commandPermissions: CommandPermissionRequirementSettings = null;
                if (botHelper.hasCommandPermissions(command)) {
                    commandPermissions = command.permissionRequirements;
                }
    
                for (let interaction of command.inputSettings.interactionSettings.interactions) {
                    if (interaction) {
                        let interactionCommandContext: InteractionRegistrationCommandContext = new InteractionRegistrationCommandContext(command, interaction, commandPermissions);
                        
                        if (interaction.registrationContext === CommandInteractionRegistrationContext.global) {
                            globalInteractions.push(interactionCommandContext);
                        } else if (interaction.registrationContext === CommandInteractionRegistrationContext.guildList) {
                            if (interaction.registrationGuilds) {
                                for (let guildId of interaction.registrationGuilds) {
                                    this.addInteractionCommandContextToGuild(guildInteractions, guildId, interactionCommandContext);
                                }
                            }
                        } else {
                            if (allGuilds) {
                                for (let guild of allGuilds) {
                                    this.addInteractionCommandContextToGuild(guildInteractions, guild.id, interactionCommandContext);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private async preRegistrationCalculation(globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>, allInteractions: InteractionRegistrationCommandContext[]): Promise<void> {
        return;
    }

    private async registerInteractionsInApi(clientId: string, token: string, globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>): Promise<void> {
        let rest: REST = new REST({ version: '10' }).setToken(token);
        if (globalInteractions) {
            let shouldUpdate: boolean = true;
            if (this.shouldRegisterCallback) {
                shouldUpdate = await this.shouldRegisterCallback(CommandInteractionRegistrationContext.global, globalInteractions, null);
            }
            if (shouldUpdate) {
                await this.registerGuildGlobalInteractions(clientId, rest, globalInteractions);
            }
        }

        if (guildInteractions) {
            let guildIds: string[] = Object.keys(guildInteractions);
            if (guildIds) {
                for (let guildId of guildIds) {
                    let interactions: InteractionRegistrationCommandContext[] = guildInteractions[guildId];
                    let shouldUpdate: boolean = true;
                    if (this.shouldRegisterCallback) {
                        shouldUpdate = await this.shouldRegisterCallback(CommandInteractionRegistrationContext.allGuilds, interactions, guildId);
                    }
                    if (shouldUpdate) {
                        await this.registerGuildInteractions(clientId, rest, guildId, interactions);
                    }
                }
            }
        }
    }

    private async registerGuildGlobalInteractions(clientId: string, rest: REST, interactions: InteractionRegistrationCommandContext[]): Promise<void> {
        this.logger.info('Registering global commands');

        try {
            let commandsData: RESTPostAPIApplicationCommandsJSONBody[] = this.getCommandsData(interactions);

            let InteractionCommandContextDictionary: BasicDictionary<InteractionRegistrationCommandContext> = this.getInteractionDictionaryByName(interactions);

            let applicationInteractions: any = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commandsData },
            );

            if (applicationInteractions && applicationInteractions.length) {
                for (let applicationCommandAny of applicationInteractions) {
                    let applicationCommand: ApplicationCommand<{ guild: GuildResolvable; }> = <ApplicationCommand<{ guild: GuildResolvable; }>>applicationCommandAny;
                    if (applicationCommand && applicationCommand.name) {
                        if (InteractionCommandContextDictionary[applicationCommand.name]) {
                            InteractionCommandContextDictionary[applicationCommand.name].discordApplicationCommand = applicationCommand;
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.error('Error registering global commands: ' + err);
        }

        this.logger.info('Finished registering global commands');
    }

    private async registerGuildInteractions(clientId: string, rest: REST, guildId: string, interactions: InteractionRegistrationCommandContext[]): Promise<void> {
        this.logger.info('Registering commands for guild ' + guildId);

        try {
            let commandsData: RESTPostAPIApplicationCommandsJSONBody[] = this.getCommandsData(interactions);
            let InteractionCommandContextDictionary: BasicDictionary<InteractionRegistrationCommandContext> = this.getInteractionDictionaryByName(interactions);

            let applicationInteractions: any = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commandsData },
            )

            if (applicationInteractions && applicationInteractions.length) {
                for (let applicationCommandAny of applicationInteractions) {
                    let applicationCommand: ApplicationCommand<{ guild: GuildResolvable; }> = <ApplicationCommand<{ guild: GuildResolvable; }>>applicationCommandAny;
                    if (applicationCommand && applicationCommand.name) {
                        if (InteractionCommandContextDictionary[applicationCommand.name]) {
                            InteractionCommandContextDictionary[applicationCommand.name].discordApplicationCommand = applicationCommand;
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.error('Error registering guild commands for guild ' + guildId + ': ' + err);
        }

        this.logger.info('Finished registering commands for guild ' + guildId);
    }

    private async postRegistration(client: Client, allGuilds: Guild[], globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>): Promise<void> {
        let allInteractionsByGuild: BasicDictionary<InteractionRegistrationCommandContext[]> = this.getAllInteractionsByGuildIncGlobal(allGuilds, globalInteractions, guildInteractions);

        if (this.registeredInteractionsCallback) {
            await this.registeredInteractionsCallback(CommandInteractionRegistrationContext.global, globalInteractions, null);
        }

        let guildIds: string[] = Object.keys(allInteractionsByGuild);
        for (let guildId of guildIds) {
            if (allInteractionsByGuild[guildId]) {
                let guildInteractions: InteractionRegistrationCommandContext[] = allInteractionsByGuild[guildId];
                if (this.registeredInteractionsCallback) {
                    await this.registeredInteractionsCallback(CommandInteractionRegistrationContext.guildList, guildInteractions, guildId);
                }
            }
        }
    }

    private getCommandsData(interactions: InteractionRegistrationCommandContext[]): RESTPostAPIApplicationCommandsJSONBody[] {
        let commandData: RESTPostAPIApplicationCommandsJSONBody[] = [];

        for (let interaction of interactions) {
            if (interaction.interaction.mainType === CommandInteractionMainType.slashCommand) {
                commandData.push(interaction.interaction.applicationCommand);
            } else {
                if (interaction.interaction.contextMenuMainTypeSettings) {
                    let contextBuilder: ContextMenuCommandBuilder = new ContextMenuCommandBuilder();
                    contextBuilder.setName(interaction.interaction.contextMenuMainTypeSettings.name);
                    contextBuilder.setType(interaction.interaction.mainType === CommandInteractionMainType.contextUser ? ApplicationCommandType.User : ApplicationCommandType.Message);

                    commandData.push(contextBuilder.toJSON());
                }
            }   
        }

        return commandData;
    }

    private getInteractionDictionaryByName(InteractionCommandContexts: InteractionRegistrationCommandContext[]): BasicDictionary<InteractionRegistrationCommandContext> {
        let returnDictionary: BasicDictionary<InteractionRegistrationCommandContext> = {};

        for (let interactionCommandContext of InteractionCommandContexts) {
            if (interactionCommandContext.interaction.mainType === CommandInteractionMainType.slashCommand) {
                returnDictionary[interactionCommandContext.interaction.applicationCommand.name] = interactionCommandContext;
            } else {
                if (interactionCommandContext.interaction.contextMenuMainTypeSettings) {
                    returnDictionary[interactionCommandContext.interaction.contextMenuMainTypeSettings.name] = interactionCommandContext;
                }
            }
        }

        return returnDictionary;
    }

    private getAllInteractionsByGuildIncGlobal(allGuilds: Guild[], globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>): BasicDictionary<InteractionRegistrationCommandContext[]> {
        let returnDictionary: BasicDictionary<InteractionRegistrationCommandContext[]> = {};

        let guildInteractionGuildIds: string[] = Object.keys(guildInteractions);
        for (let guildInteractionGuildId of guildInteractionGuildIds) {
            let guildCommandInteractions: InteractionRegistrationCommandContext[] = guildInteractions[guildInteractionGuildId];
            if (!returnDictionary[guildInteractionGuildId]) {
                returnDictionary[guildInteractionGuildId] = [];
            }

            for (let guildInteraction of guildCommandInteractions) {
                returnDictionary[guildInteractionGuildId].push(guildInteraction);
            }
        }

        for (let guild of allGuilds) {
            if (!returnDictionary[guild.id]) {
                returnDictionary[guild.id] = [];
            }

            for (let globalCommand of globalInteractions) {
                returnDictionary[guild.id].push(globalCommand);
            }
        }

        return returnDictionary;
    }

    private getAllInteractionCommandContexts(globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>): InteractionRegistrationCommandContext[] {
        let allContexts: InteractionRegistrationCommandContext[] = [];

        for (let globalContext of globalInteractions) {
            allContexts.push(globalContext);
        }

        let guildIds: string[] = Object.keys(guildInteractions);
        if (guildIds) {
            for (let guildId of guildIds) {
                let guildContexts: InteractionRegistrationCommandContext[] = guildInteractions[guildId];
                for (let guildContext of guildContexts) {
                    allContexts.push(guildContext);
                }
            }
        }

        return allContexts;
    }

    private addInteractionCommandContextToGuild(guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>, guildId: string, commandContext: InteractionRegistrationCommandContext): void {
        if (guildInteractions && guildId && commandContext) {
            if (!guildInteractions[guildId]) {
                guildInteractions[guildId] = [];
            }

            guildInteractions[guildId].push(commandContext);
        }
    }
}