/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */
import { Provider } from 'nconf';
import { IDiscordBot, BotStatus, IAutoManagedBot } from '../../models/DiscordBot';
import { ICommandPermissions, CommandPermissionFeedbackType, CommandPermissionResult, 
        CommandPermissionResultStatus } from '../../models/CommandPermission';
import { BitFieldResolvable, Client, Guild, Intents, IntentsString, Interaction, Message, TextChannel } from 'discord.js';

// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { CommandInteractionParser, CommandMessageParser } from '../command.logic';
import { ICommand, ICommandResult, CommandResult, CommandResultStatus, CommandInputContext, CommandInput } from '../../models/Command';
import { CommandPermissionsService } from '../services/permissions.service';
import { MessengerService } from '../services/messenger.service';
import { ILogger } from 'tsdatautils-core';
import { InteractionRegistryService } from '../services/interaction-registry.service';

export class MultiGuildBot implements IDiscordBot, IAutoManagedBot {
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
    protected conf: Provider = null;
    protected botToken: string = '';
    protected status: BotStatus = BotStatus.inactive;

    constructor(passedBotName: string, passedBotToken: string, passedLogger: ILogger, 
                passedConf: Provider) {
        this.name = passedBotName;
        this.botToken = passedBotToken;
        this.logger = passedLogger;
        this.conf = passedConf;

        this.subscribeToSubjects();
        this.setupBot();
    }

    public async startBot(intents: BitFieldResolvable<IntentsString, number> = null): Promise<string> {
        if (this.botToken === '') {
            this.botError('No token found');
            throw 'No token found';
        }

        if (!intents) {
            intents = [Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES,
                Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
                Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.DIRECT_MESSAGE_REACTIONS];
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

    // tslint:disable-next-line:no-empty
    public setupBot(): void {

        // Default command parser setup
        let commands: ICommand[] = this.setupCommands();
        for (let command of commands) {
            command.setupInputSettings(this);
            if ((<any>command).setupPermissions) {
                (<ICommandPermissions><unknown>command).setupPermissions(this, CommandInputContext.none, null, null);
            }
            this.commands.push(command);
        }
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

    public async registerInteractions(): Promise<void> {
        let interactionRegistryService: InteractionRegistryService = new InteractionRegistryService(this.logger);
        await interactionRegistryService.registerInteractions(this.botClient, this.botClient.user.id, this.botToken, [...this.botClient.guilds.cache.values()], this.commands);
    }

    // tslint:disable-next-line:no-empty
    protected setupCommandPreExecute(command: ICommand): void {
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
            let commands: ICommand[] = commandInteractionParser.getCommandsForInteractionInput(interaction);
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
        let commandAny: any = <any>command;

        let hasPermissions: boolean = true;
        let permissionCommandResult: CommandResult = null;
        if (commandAny.permissionRequirements) {
            let commandPermissions = <ICommandPermissions>commandAny;
            commandPermissions.setupPermissions(this, CommandInputContext.message, msg, null);
            let permissionService: CommandPermissionsService = new CommandPermissionsService();

            let permissionResult: CommandPermissionResult = await permissionService.hasPermissions(commandPermissions, CommandInputContext.message, msg, null);
            if (permissionResult.permissionStatus === CommandPermissionResultStatus.noPermission) {
                hasPermissions = false;

                permissionCommandResult = CommandResult.buildSimpleError('Lack permission to run this', new Error('Lack of permissions'));
                permissionCommandResult.replyHandled = true;
                
                this.botInfo('User ' + msg.member.user.username + ' tried to run command ' + command.commandName 
                            + '(' + msg.content + ') and lacked permission.');
                this.handleLackPermissionReply(commandPermissions, new CommandInput(CommandInputContext.message, msg, null));
                this.handleLackPermissionDeleteMessage(permissionResult, new CommandInput(CommandInputContext.message, msg, null));                
            }
        }

        if (hasPermissions) {
            // they have permission, run the command
            this.setupCommandPreExecute(command);

            let executeResult: ICommandResult = await command.execute(this, new CommandInput(CommandInputContext.message, msg, null));

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
        let commandAny: any = <any>command;

        let hasPermissions: boolean = true;
        let permissionCommandResult: CommandResult = null;
        if (commandAny.permissionRequirements) {
            let commandPermissions = <ICommandPermissions>commandAny;
            commandPermissions.setupPermissions(this, CommandInputContext.interaction, null, interaction);
            let permissionService: CommandPermissionsService = new CommandPermissionsService();

            let permissionResult: CommandPermissionResult = await permissionService.hasPermissions(commandPermissions, CommandInputContext.interaction, null, interaction);
            if (permissionResult.permissionStatus === CommandPermissionResultStatus.noPermission) {
                hasPermissions = false;

                permissionCommandResult = CommandResult.buildSimpleError('Lack permission to run this', new Error('Lack of permissions'));
                permissionCommandResult.replyHandled = true;
                
                this.botInfo('User ' + interaction.member.user.username + ' tried to run command ' + command.commandName + ' and lacked permission.');
                this.handleLackPermissionReply(commandPermissions, new CommandInput(CommandInputContext.interaction, null, interaction));
                this.handleLackPermissionDeleteMessage(permissionResult, new CommandInput(CommandInputContext.interaction, null, interaction));                
            }
        }

        if (hasPermissions) {
            // they have permission, run the command
            this.setupCommandPreExecute(command);

            let executeResult: ICommandResult = await command.execute(this, new CommandInput(CommandInputContext.interaction, null, interaction));

            if (executeResult.status === CommandResultStatus.error) {
                throw executeResult;
            }

            return executeResult;
        } else {
            throw permissionCommandResult;
        }
    }

    protected handleLackPermissionReply(commandPermissions: ICommandPermissions, input: CommandInput): void {
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
                if (input.interaction.isCommand()) {
                    input.interaction.reply(replyMessage);
                } else if (input.interaction.isContextMenu()) {
                    input.interaction.reply(replyMessage);
                }
            }
        }
        
    }

    protected handleLackPermissionDeleteMessage(permissionResult: CommandPermissionResult, input: CommandInput): void {
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
