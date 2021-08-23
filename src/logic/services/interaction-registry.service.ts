/* eslint-disable @typescript-eslint/no-explicit-any */
import { APIApplicationCommandOption } from "discord-api-types";
import { ApplicationCommand, Client, Guild, GuildResolvable, Role, User } from "discord.js";
import { ILogger } from "tsdatautils-core";
import { BasicDictionary } from "../../models/BasicDictionary";
import { CommandInteraction, CommandInteractionMainType, CommandInteractionRegistrationContext, ICommand } from "../../models/Command";
import { CommandPermissionGrantRevokeType, CommandPermissionRequirement, CommandPermissionRequirementSettings, CommandPermissionType } from "../../models/CommandPermission";
import { BotHelper } from "../helpers/bot.helper";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

export class InteractionRegistrationCommandContext {
    public command: ICommand;
    public commandPermissions: CommandPermissionRequirementSettings;
    public interaction: CommandInteraction;
    public hasDefaultPermission: boolean;
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
            
            // Set permissions
            await this.setInteractionPermissions(client, allGuilds, globalInteractions, guildInteractions);

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
        for (let command of allInteractions) {
            this.setCommandDefaultPermission(command);
        }
    }

    private setCommandDefaultPermission(command: InteractionRegistrationCommandContext): void {
        let defaultPermission: boolean = true;
        if (command.interaction.overridePermissions) {
            defaultPermission = command.interaction.overridePermissions.hasPermissionByDefault;
        } else if (command.commandPermissions) {
            defaultPermission = command.commandPermissions.hasPermissionByDefault;
        }

        command.hasDefaultPermission = defaultPermission;
    }

    private async registerInteractionsInApi(clientId: string, token: string, globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>): Promise<void> {
        let rest: REST = new REST({ version: '9' }).setToken(token);
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
        let interactionBuilderData: { name: string; description: string; options: APIApplicationCommandOption[]; }[] = this.getBuilderData(interactions);

        let InteractionCommandContextDictionary: BasicDictionary<InteractionRegistrationCommandContext> = this.getInteractionDictionaryByName(interactions);
        this.logger.info('Registering global commands');

        try {
            let applicationInteractions: any = await rest.put(
                Routes.applicationCommands(clientId),
                { body: interactionBuilderData },
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
        let interactionBuilderData: { name: string; description: string; options: APIApplicationCommandOption[]; }[] = this.getBuilderData(interactions);
        let InteractionCommandContextDictionary: BasicDictionary<InteractionRegistrationCommandContext> = this.getInteractionDictionaryByName(interactions);
        this.logger.info('Registering commands for guild ' + guildId);

        try {
            let applicationInteractions: any = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: interactionBuilderData },
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

    private async setInteractionPermissions(client: Client, allGuilds: Guild[], globalInteractions: InteractionRegistrationCommandContext[], guildInteractions: BasicDictionary<InteractionRegistrationCommandContext[]>): Promise<void> {
        let allInteractionsByGuild: BasicDictionary<InteractionRegistrationCommandContext[]> = this.getAllInteractionsByGuildIncGlobal(allGuilds, globalInteractions, guildInteractions);
        
        let shouldRegisterGlobal: boolean = true;
        if (this.shouldRegisterCallback) {
            shouldRegisterGlobal = await this.shouldRegisterCallback(CommandInteractionRegistrationContext.global, globalInteractions, null);
        }

        let guildIds: string[] = Object.keys(allInteractionsByGuild);
        for (let guildId of guildIds) {
            let guild: Guild = client.guilds.cache.get(guildId);
            if (guild && allInteractionsByGuild[guildId]) {
                try {
                    let guildPermissionUpdates: any[] = [];

                    let guildInteractions: InteractionRegistrationCommandContext[] = allInteractionsByGuild[guildId];
                    let shouldUpdateGuild: boolean = true;
                    if (this.shouldRegisterCallback) {
                        shouldUpdateGuild = await this.shouldRegisterCallback(CommandInteractionRegistrationContext.guildList, guildInteractions, guildId);
                    }
                    if (shouldRegisterGlobal || shouldUpdateGuild) {
                        let discoveredGuildRoles: BasicDictionary<Role> = {};
                        let discoveredUsers: BasicDictionary<User> = {}
                        for (let guildInteraction of guildInteractions) {
                            if (guildInteraction && guildInteraction.discordApplicationCommand) {
                                let updateObj = await this.getGuildInteractionPermissionUpdate(client, guild, guildInteraction, discoveredGuildRoles, discoveredUsers);
                                if (updateObj) {
                                    guildPermissionUpdates.push(updateObj);
                                }
                            }
                        }

                        await guild.commands.permissions.set({ fullPermissions: guildPermissionUpdates });
                    }
                } catch (err) {
                    this.logger.error('Error setting interaction permission for guild ' + guild.id + ' (' + guild.name + '): ' + err);
                }
            }
        }
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

    private async getGuildInteractionPermissionUpdate(client: Client, guild: Guild, interactionCommandContext: InteractionRegistrationCommandContext, discoveredGuildRoles: BasicDictionary<Role>, discoveredUsers: BasicDictionary<User>): Promise<any> {
        let returnObj: any = {
            id: interactionCommandContext.discordApplicationCommand.id,
            permissions: []
        };

        let permissionRequirements: CommandPermissionRequirement[] = null;
        if (interactionCommandContext.interaction.overridePermissions) {
            permissionRequirements = interactionCommandContext.interaction.overridePermissions.requirements;
        } else if (interactionCommandContext.commandPermissions) {
            permissionRequirements = interactionCommandContext.commandPermissions.requirements;
        }

        if (!permissionRequirements) {
            return null;
        }

        let calculatedPermissions: { id: string; type: string; permission: boolean; }[] = [];
        for (let permissionRequirement of permissionRequirements) {
            let calculatedPermission: { id: string; type: string; permission: boolean; } = { id: null, type: null, permission: false };

            if (permissionRequirement.successGrantRevokeType !== CommandPermissionGrantRevokeType.none) {
                if (permissionRequirement.successGrantRevokeType === CommandPermissionGrantRevokeType.grant) {
                    calculatedPermission.permission = true;
                } else {
                    calculatedPermission.permission = false;
                }
            } else {
                // this permission requirement does nothing on success, so not relevant
                continue;
            }

            let identifierLowered: string = permissionRequirement.identifier.toLowerCase();
            if (permissionRequirement.permissionType === CommandPermissionType.role) {
                if (!discoveredGuildRoles[identifierLowered]) {
                    let role = guild.roles.cache.find(role => role.name.toLowerCase() === identifierLowered);
                    if (role) {
                        discoveredGuildRoles[identifierLowered] = role;
                    }
                }

                if (!discoveredGuildRoles[identifierLowered]) {
                    // couldn't find the role, skip this requirement
                    continue;
                }

                calculatedPermission.id = discoveredGuildRoles[identifierLowered].id;
                calculatedPermission.type = 'ROLE';
            } else if (permissionRequirement.permissionType === CommandPermissionType.user) {
                if (!discoveredUsers[identifierLowered]) {
                    let member = guild.members.cache.find(member => member.user.id.toLowerCase() === identifierLowered || member.user.username.toLowerCase() === identifierLowered || member.displayName.toLowerCase() === identifierLowered);
                    if (member) {
                        discoveredUsers[identifierLowered] = member.user;
                    }
                }

                if (!discoveredUsers[identifierLowered]) {
                    // couldn't find the user, skip this requirement
                    continue;
                }

                calculatedPermission.id = discoveredUsers[identifierLowered].id;
                calculatedPermission.type = 'USER';
            } else {
                // permission requirement isn't user or role
                continue;
            }

            calculatedPermissions.push(calculatedPermission);
        }

        returnObj.permissions = calculatedPermissions;

        return returnObj;
    }

    private getBuilderData(interactions: InteractionRegistrationCommandContext[]): { name: string; description: string; options: APIApplicationCommandOption[]; type?: number }[] {
        let builderData: { name: string; description: string; options: APIApplicationCommandOption[]; default_permission?: boolean; type?: number }[] = [];

        for (let interaction of interactions) {
            if (interaction.interaction.mainType === CommandInteractionMainType.slashCommand) {
                let commandBuilderData = <{ name: string; description: string; options: APIApplicationCommandOption[]; default_permission?: boolean }>interaction.interaction.builder.toJSON();
                commandBuilderData.default_permission = interaction.hasDefaultPermission;
                builderData.push(commandBuilderData);
            } else {
                if (interaction.interaction.contextMenuMainTypeSettings) {
                    let commandBuilderData: { name: string; description: string; options: APIApplicationCommandOption[]; default_permission?: boolean; type?: number } = { 
                        name: interaction.interaction.contextMenuMainTypeSettings.name,
                        description: '',
                        options: null,
                        default_permission: interaction.hasDefaultPermission,
                        type: interaction.interaction.mainType === CommandInteractionMainType.contextUser ? 2 : 3
                    };

                    builderData.push(commandBuilderData);
                }
            }   
        }

        return builderData;
    }

    private getInteractionDictionaryByName(InteractionCommandContexts: InteractionRegistrationCommandContext[]): BasicDictionary<InteractionRegistrationCommandContext> {
        let returnDictionary: BasicDictionary<InteractionRegistrationCommandContext> = {};

        for (let interactionCommandContext of InteractionCommandContexts) {
            if (interactionCommandContext.interaction.mainType === CommandInteractionMainType.slashCommand) {
                returnDictionary[interactionCommandContext.interaction.builder.name] = interactionCommandContext;
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