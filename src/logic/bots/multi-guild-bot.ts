/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Provider } from 'nconf';
import { IDiscordBot, BotStatus, IAutoManagedBot } from '../../models/DiscordBot';
import { ICommandPermissions, CommandPermissionFeedbackType, CommandPermissionResult, 
        CommandPermissionResultStatus } from '../../models/CommandPermission';
import { Client, Guild, Interaction, Message, TextChannel, GatewayIntentBits } from 'discord.js';
import * as Rx from 'rxjs/Rx';
import { CommandInteractionParser, CommandMessageParser } from '../command.logic';
import { ICommand, ICommandResult, CommandResult, CommandResultStatus, CommandInputContext, CommandUserInput, CommandInteractionRegistrationContext } from '../../models/Command';
import { CommandPermissionsService } from '../services/permissions.service';
import { MessengerService } from '../services/messenger.service';
import { ILogger } from 'tsdatautils-core';
import { InteractionRegistrationCommandContext, InteractionRegistryService } from '../services/interaction-registry.service';
import { HashService } from '../services/hash.service';
import { FileObjectService } from '../services/file-object.service';
import { BotCommandSetting, CommandSetting, ICommandSettings, ICommandSettingsBot } from '../../models/CommandSettings';
import { SettingsCommand } from '../commands/settings.command';

export class MultiGuildBot implements IDiscordBot, IAutoManagedBot, ICommandSettingsBot {
    public guilds: Guild[] = [];
    public name: string = 'Discord Bot';
    public color: number = 3381759;
    //Public Events
    public onBotReady: Rx.Subject<boolean> = new Rx.Subject<boolean>();
    public onBotLoggedIn: Rx.Subject<boolean> = new Rx.Subject<boolean>();
    public onBotLoggedOut: Rx.Subject<boolean> = new Rx.Subject<boolean>();
    public onBotStatusChange: Rx.Subject<BotStatus> = new Rx.Subject<BotStatus>();
    public onBotRequiresRestart: Rx.Subject<string> = new Rx.Subject<string>();
    public onBotMessage: Rx.Subject<Message> = new Rx.Subject<Message>();
    public onBotInteraction: Rx.Subject<Interaction> = new Rx.Subject<Interaction>();
    public onBotError: Rx.Subject<Error> = new Rx.Subject<Error>();
    public onBotWarning: Rx.Subject<string> = new Rx.Subject<string>();
    public onBotJoinGuild: Rx.Subject<Guild> = new Rx.Subject<Guild>();
    public onBotLeaveGuild: Rx.Subject<Guild> = new Rx.Subject<Guild>();
    public logger: ILogger = null;
    public botClient: Client = null;
    public commands: ICommand[] = [];
    public getSettingsCallback: (botId: string, guildId: string) => Promise<BotCommandSetting[]>;
    public saveSettingCallback: (commandSetting: BotCommandSetting) => Promise<boolean>;
    protected conf: Provider = null;
    protected botToken: string = '';
    protected status: BotStatus = BotStatus.inactive;

    protected commandSettings: CommandSetting[] = [];
    protected addSettingsCommand: boolean = true;

    constructor(passedBotName: string, passedBotToken: string, passedLogger: ILogger, 
                passedConf: Provider) {
        this.name = passedBotName;
        this.botToken = passedBotToken;
        this.logger = passedLogger;
        this.conf = passedConf;

        this.subscribeToSubjects();
    }

    public async startBot(intents: GatewayIntentBits[] = null): Promise<string> {
        if (this.botToken === '') {
            this.botError('No token found');
            throw 'No token found';
        }

        if (!intents) {
            intents = [GatewayIntentBits.GuildMembers, GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageReactions, GatewayIntentBits.DirectMessageTyping,
                GatewayIntentBits.GuildScheduledEvents, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildInvites, GatewayIntentBits.MessageContent];
        }

        this.botClient = new Client({ intents: intents });
        this.setupBotEvents();

        try {
            await this.botClient.login(this.botToken);
            this.botInfo('Logged in.');
            this.onBotLoggedIn.next(true);

            return 'logged in';
        } catch (err) {
            this.botError('Error logging in bot: ' + err);
            throw err;
        }
    }

    public async stopBot(): Promise<string> {
        this.botClient.destroy();
        this.botInfo('Stopped.');
        this.onBotLoggedOut.next(true);
        return 'stopped';
    }

    public async setupBot(): Promise<void> {
        // Setup bot-level settings
        if (this.addSettingsCommand) {
            let botSettings: CommandSetting[] = await this.setupBotSettings();
            for (let botSetting of botSettings) {
                this.commandSettings.push(botSetting);
            }
        }

        // Default command parser setup
        let commands: ICommand[] = this.setupCommands();
        for (let command of commands) {
            try {
                command.setupInputSettings(this);

                if (this.isCommandPermissions(command)) {
                    await command.setupPermissions(this, new CommandUserInput(CommandInputContext.none, null, null));
                }

                if (this.addSettingsCommand && this.isCommandSettings(command)) {
                    let settings: CommandSetting[] = await command.getSettings();
                    if (settings) {
                        for (let setting of settings) {
                            this.commandSettings.push(setting);
                        }
                    }
                }

                this.commands.push(command);
            } catch (error) {
                this.botError('Error setting up command ' + command.commandName + ': ' + error);
            }
        }

        if (this.addSettingsCommand && this.commandSettings && this.commandSettings.length > 0) {
            let settingCommand: SettingsCommand = new SettingsCommand('Settings', 'Settings for ' + this.name, this.logger, this.conf, this, this.commandSettings, this.getSettingsCallback, this.saveSettingCallback);
            settingCommand.setupInputSettings(this);
            this.commands.push(settingCommand);
        }
    }

    private isCommandPermissions(item: object): item is ICommandPermissions {
        return 'setupPermissions' in item;
    }

    private isCommandSettings(item: object): item is ICommandSettings {
        return 'getSettings' in item;
    }

    public async setupBotSettings(): Promise<CommandSetting[]> {
        return [];
    }

    public setupCommands(): ICommand[] {

        return [];
    } 

    public getStatus(): BotStatus {
        return this.status;
    }

    public setStatus(status: BotStatus): void {
        this.status = status;
        this.onBotStatusChange.next(status);
    }

    public addCommand(command: ICommand): void {
        this.commands.push(command);
    }

    public restartBotDueToError(err: string): void {
        this.onBotRequiresRestart.next(err);
    }

    public async registerInteractions(force: boolean = false): Promise<void> {
        if (force) {
            try {
                let fileObjectService: FileObjectService = new FileObjectService();
                await fileObjectService.deleteAllFiles('interactionRegistryHashes/');
            } catch (err) {
                this.logger.error('Error deleting existing registration files: ' + err);
            }
        }
        
        let interactionRegistryService: InteractionRegistryService = new InteractionRegistryService(this.logger, this.shouldRegisterInteractions, this.postInteractionRegistration);
        await interactionRegistryService.registerInteractions(this.botClient, this.botClient.user.id, this.botToken, [...this.botClient.guilds.cache.values()], this.commands);
    }

    public async shouldRegisterInteractions(context: CommandInteractionRegistrationContext, interactions: InteractionRegistrationCommandContext[], botId: string, guildId: string): Promise<boolean> {
        let shouldRegister: boolean = true;

        try {
            let fileObjectService: FileObjectService = new FileObjectService();
            let hashService: HashService = new HashService();
            
            let anyDifferent: boolean = false;
            for (let interactionContext of interactions) {
                if (!interactionContext.interaction || !interactionContext.interaction.applicationCommand) {
                    continue;
                }

                let interactionJson: string = JSON.stringify(interactionContext.interaction.applicationCommand);
                let fileName: string = interactionContext.command.commandName + '_' + interactionContext.interaction.applicationCommand.name;
        
                if (context !== CommandInteractionRegistrationContext.global) {
                    let newFileName: string = '';
                    if (guildId) {
                        newFileName += guildId + '_';
                    }
                    if (botId) {
                        newFileName += botId + '_';
                    }
                    fileName = newFileName + fileName;
                }

                fileName = 'interactionRegistryHashes/' + fileName;

                let interactionHash: string = hashService.getHash(interactionJson);
                let fileHash: { interactionHash: string } = await fileObjectService.getFromFile<{ interactionHash: string }>(fileName);

                if (!fileHash || !interactionHash || interactionHash !== fileHash.interactionHash) {
                    anyDifferent = true;
                    break;
                }
            }

            if (!anyDifferent) {
                shouldRegister = false;
            }
        } catch (err) {
            this.logger.error('Error determining if the bot should register interactions: ' + err);
        }

        return shouldRegister;
    }

    public async postInteractionRegistration(context: CommandInteractionRegistrationContext, interactions: InteractionRegistrationCommandContext[], botId: string, guildId: string): Promise<void> {
        try {
            let fileObjectService: FileObjectService = new FileObjectService();
            let hashService: HashService = new HashService();
            
            for (let interactionContext of interactions) {
                if (!interactionContext.interaction || !interactionContext.interaction.applicationCommand) {
                    continue;
                }

                let interactionJson: string = JSON.stringify(interactionContext.interaction.applicationCommand);
                let fileName: string = interactionContext.command.commandName + '_' + interactionContext.interaction.applicationCommand.name;

                if (context !== CommandInteractionRegistrationContext.global) {
                    let newFileName: string = '';
                    if (guildId) {
                        newFileName += guildId + '_';
                    }
                    if (botId) {
                        newFileName += botId + '_';
                    }
                    fileName = newFileName + fileName;
                }
                
                fileName = 'interactionRegistryHashes/' + fileName;

                let interactionHash: string = hashService.getHash(interactionJson);
                
                await fileObjectService.setToFile<{ interactionHash: string }>(fileName, { interactionHash: interactionHash });
            }
        } catch (err) {
            this.logger.error('Error handling post interaction registration: ' + err);
        }
    }

    public async getCommandSetting(name: string, guildId: string): Promise<unknown> {
        if (this.getSettingsCallback) {
            let commandSettings: BotCommandSetting[] = await this.getSettingsCallback(this.botClient.user.id, guildId);
            for (let commandSetting of commandSettings) {
                if (commandSetting && commandSetting.name === name) {
                    return commandSetting.value;
                }
            }
        }

        return null;
    }
    
    protected setupCommandPreExecute(command: ICommand): void {
        return;
    }

    private deleteRegistrationFiles(): void {

    }

    private isICommandResultError(object: any): object is ICommandResult {
        return 'error' in object && 'message' in object && 'commandName' in object;
    }

    protected handleMessage(msg: Message): void {
        if (this.commands) {
            let commandMessageParser: CommandMessageParser = new CommandMessageParser(this.commands);
            let commands: ICommand[] = commandMessageParser.getCommandsForMessageInput(msg.content);
            if (commands) {
                for (let command of commands) {
                    if (command) {
                        this.handleCommandMessage(command, msg).catch((cmdErr: any) => {
                            if (this.isICommandResultError(cmdErr)) {
                                this.botError('Error processing command ' + command.commandName + ': ' 
                                            + cmdErr.error + ' - Message: ' + cmdErr.message);
                            } else {
                                this.botError('Error handling message by ' + msg.member.nickname + ': ' + cmdErr);
                            }
                        });
                    }
                }
            }
        }
    }

    protected handleInteraction(interaction: Interaction): void {
        if (this.commands) {
            let commandInteractionParser: CommandInteractionParser = new CommandInteractionParser(this.commands);
            let commands: ICommand[] = commandInteractionParser.getCommandsForInteractionInput(this, interaction);
            if (commands) {
                for (let command of commands) {
                    if (command) {
                        this.handleCommandInteraction(command, interaction).catch((cmdErr: any) => {
                            if (this.isICommandResultError(cmdErr)) {
                                this.botError('Error processing interaction command ' + command.commandName + ': ' 
                                            + cmdErr.error + ' - Message: ' + cmdErr.message);
                            } else {
                                this.botError('Error handling interaction message by ' + interaction.member.user.username + ': ' + cmdErr);
                            }
                        });
                    }
                }
            }
        }
    }

    protected async handleCommandMessage(command: ICommand, msg: Message): Promise<ICommandResult> {
        // handle permissions
        let permissionCommandResult: CommandResult = await this.handleCommandPermissionRequirements(command, CommandInputContext.message, msg, null);

        if (permissionCommandResult.status === CommandResultStatus.success) {
            // they have permission, run the command
            this.setupCommandPreExecute(command);

            let executeResult: ICommandResult = await command.execute(this, new CommandUserInput(CommandInputContext.message, msg, null));

            if (executeResult.status === CommandResultStatus.error) {
                throw executeResult;
            }

            return executeResult;
        } else {
            throw permissionCommandResult;
        }
    }

    protected async handleCommandInteraction(command: ICommand, interaction: Interaction): Promise<ICommandResult> {
        // handle permissions
        let permissionCommandResult: CommandResult = await this.handleCommandPermissionRequirements(command, CommandInputContext.interaction, null, interaction);

        if (permissionCommandResult.status === CommandResultStatus.success) {
            // they have permission, run the command
            this.setupCommandPreExecute(command);

            let executeResult: ICommandResult = await command.execute(this, new CommandUserInput(CommandInputContext.interaction, null, interaction));

            if (executeResult.status === CommandResultStatus.error) {
                throw executeResult;
            }

            return executeResult;
        } else {
            throw permissionCommandResult;
        }
    }

    protected async handleCommandPermissionRequirements(command: ICommand, inputContext: CommandInputContext, msg: Message, interaction: Interaction): Promise<CommandResult> {
        let permissionCommandResult: CommandResult = new CommandResult();
        permissionCommandResult.status = CommandResultStatus.success;

        let commandAny: any = <any>command;
        if (commandAny.permissionRequirements) {
            let commandPermissions = <ICommandPermissions>commandAny;
            await commandPermissions.setupPermissions(this, new CommandUserInput(inputContext, msg, interaction));
            let permissionService: CommandPermissionsService = new CommandPermissionsService();

            let permissionResult: CommandPermissionResult = await permissionService.hasPermissions(commandPermissions, inputContext, msg, interaction);
            if (permissionResult.permissionStatus === CommandPermissionResultStatus.noPermission) {
                permissionCommandResult = CommandResult.buildSimpleError('Lack permission to run this', new Error('Lack of permissions'));
                permissionCommandResult.replyHandled = true;
                
                this.botInfo('User ' + interaction.member.user.username + ' tried to run command ' + command.commandName + ' and lacked permission.');
                this.handleLackPermissionReply(commandPermissions, new CommandUserInput(inputContext, msg, interaction));
                this.handleLackPermissionDeleteMessage(permissionResult, new CommandUserInput(inputContext, msg, interaction));                
            }
        }

        return permissionCommandResult;
    }

    protected handleLackPermissionReply(commandPermissions: ICommandPermissions, input: CommandUserInput): void {
        let messengerService: MessengerService = new MessengerService();
        let replyMessage: string = commandPermissions.getPermissionFailReplyText(input.inputContext, input.msg, input.interaction);

        if (input.inputContext === CommandInputContext.message) {
            let msg: Message = input.msg;
            switch (commandPermissions.permissionFailReplyType) {
                case CommandPermissionFeedbackType.silent:
                    break;
                case CommandPermissionFeedbackType.direct:
                    messengerService.sendDirectChannelMessage(this, msg.member.user, replyMessage);
                    break;
                case CommandPermissionFeedbackType.textchannel:
                    messengerService.sendTextChannelMessage(this, <TextChannel>msg.channel, replyMessage);
                    break;
                default:
            }
        } else {
            if (input.interaction) {
                if ((<any>input.interaction).reply) {
                    (<any>input.interaction).reply(replyMessage);
                }
            }
        }
        
    }

    protected handleLackPermissionDeleteMessage(permissionResult: CommandPermissionResult, input: CommandUserInput): void {
        if (input.inputContext === CommandInputContext.message) {
            let msg: Message = input.msg;
            for (let failedRequirement of permissionResult.failedCommandRequirements) {
                if (failedRequirement.deleteMessageIfFail && msg.deletable) {
                    msg.delete();
                    break;
                }
            }
        }
    }

    protected botInfo(info: string): void {
        this.logger.info(this.name + ' - ' + info);
    }

    protected botWarn(warn: string): void {
        this.logger.warn(this.name + ' - ' + warn);
    }

    protected botError(error: string): void {
        this.logger.error(this.name + ' - ' + error);
    }

    protected botDebug(debug: string): void {
        this.logger.debug(this.name + ' - ' + debug);
    }

    private updateGuildsConnectedTo(): void {
        this.guilds = [...this.botClient.guilds.cache.values()];
    }

    private setupBotEvents(): void {
        this.botClient.on('messageCreate', (message: Message) => {
            this.onBotMessage.next(message);
        });

        this.botClient.on('error', (error: Error) => {
            this.onBotError.next(error);
        });

        this.botClient.on('warn', (warning: string) => {
            this.onBotWarning.next(warning);
        });

        this.botClient.on('ready', () => {
            this.onBotReady.next(true);
        });

        this.botClient.on('guildCreate', (guild: Guild) => {
            this.onBotJoinGuild.next(guild);
        });

        this.botClient.on('guildDelete', (guild: Guild) => {
            this.onBotLeaveGuild.next(guild);
        });

        this.botClient.on('interactionCreate', (interaction: Interaction) => {
            this.onBotInteraction.next(interaction);
        });
    }

    private subscribeToSubjects(): void {

        this.onBotLoggedIn.subscribe(() => {
            this.setStatus(BotStatus.active);
        });

        this.onBotLoggedOut.subscribe(() => {
            this.setStatus(BotStatus.inactive);
        });

        this.onBotRequiresRestart.subscribe((err: string) => {
            this.botError('An error occured requiring the bot to restart. If there is a bot manager with restart turned on,'
                    + ' the bot should restart automatically. Error: ' + err);
        });

        this.onBotError.subscribe((err: Error) => {
            this.botError('Error name: ' + err.name + ', Message: ' + err.message + ', Stack: ' + err.stack);
        });

        this.onBotWarning.subscribe((warning: string) => {
            this.botWarn(warning);
        });

        this.onBotReady.subscribe(() => {
            this.botInfo('Bot ready.');
            this.updateGuildsConnectedTo();
        });

        this.onBotJoinGuild.subscribe((guild: Guild) => {
            this.botInfo('Bot joined guild \'' + guild.name + '\', id: ' + guild.id);
            this.updateGuildsConnectedTo();
        });

        this.onBotLeaveGuild.subscribe((guild: Guild) => {
            this.botInfo('Bot left guild \'' + guild.name + '\', id: ' + guild.id);
            this.updateGuildsConnectedTo();
        });

        this.onBotMessage.subscribe((message: Message) => {
            this.handleMessage(message);
        });

        this.onBotInteraction.subscribe((interaction: Interaction) => {
            this.handleInteraction(interaction);
        });
    }
}
