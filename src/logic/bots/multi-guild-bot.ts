/* eslint-disable @typescript-eslint/no-empty-function */
import { Logger } from 'winston';
import { Provider } from 'nconf';
import { IDiscordBot, BotStatus, IAutoManagedBot } from '../../models/DiscordBot';
import { ICommandPermissions, CommandPermissionFeedbackType, CommandPermissionResult, 
        CommandPermissionResultStatus } from '../../models/CommandPermission';
import { BitFieldResolvable, Client, Guild, Intents, IntentsString, Message, TextChannel } from 'discord.js';

// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { CommandParser } from '../command.logic';
import { ICommand, ICommandResult, CommandResult, CommandResultStatus, CommandInputContext } from '../../models/Command';
import { CommandPermissionsService } from '../services/permissions.service';
import { MessengerService } from '../services/messenger.service';

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
    public onBotError: Rx.Subject<Error> = new Rx.Subject<Error>();
    public onBotWarning: Rx.Subject<string> = new Rx.Subject<string>();
    public onBotJoinGuild: Rx.Subject<Guild> = new Rx.Subject<Guild>();
    public onBotLeaveGuild: Rx.Subject<Guild> = new Rx.Subject<Guild>();
    public logger: Logger = null;
    protected conf: Provider = null;
    protected botToken: string = '';
    protected botClient: Client = null;
    protected status: BotStatus = BotStatus.inactive;
    protected commandParsers: CommandParser[] = [];

    constructor(passedBotName: string, passedBotToken: string, passedLogger: Logger, 
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
        let commandParsers: CommandParser[] = this.setupCommands();
        for (let parser of commandParsers) {
            this.commandParsers.push(parser);
        }

    }

    public setupCommands(): CommandParser[] {

        return [];
    } 

    public getStatus(): BotStatus {
        return this.status;
    }

    public setStatus(status: BotStatus): void {
        this.status = status;
        this.onBotStatusChange.next(status);
    }

    public addCommandParser(parser: CommandParser): void {
        this.commandParsers.push(parser);
    }

    public restartBotDueToError(err: string): void {
        this.onBotRequiresRestart.next(err);
    }

    // tslint:disable-next-line:no-empty
    protected setupCommandPreExecute(command: ICommand): void {
    }

    private isICommandResultError(object: any): object is ICommandResult {
        return 'error' in object && 'message' in object && 'commandName' in object;
    }

    protected handleMessage(msg: Message): void {
        for (let commandParser of this.commandParsers) {
            let command: ICommand = commandParser.parseCommand(msg.content);
            if (command !== null) {
                try {
                    this.handleCommand(command, msg);
                } catch (cmdErr) {
                    if (this.isICommandResultError(cmdErr)) {
                        this.botError('Error processing command ' + command.commandName + ': ' 
                                    + cmdErr.error + ' - Message: ' + cmdErr.message);
                    } else {
                        this.botError('Error handling message by ' + msg.member.nickname + ': ' + cmdErr);
                    }
                }
            }
        }
    }

    protected async handleCommand(command: ICommand, msg: Message): Promise<ICommandResult> {
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
                this.handleLackPermissionReply(commandPermissions, msg);
                this.handleLackPermissionDeleteMessage(permissionResult, msg);                
            }
        }

        if (hasPermissions) {
            // they have permission, run the command
            this.setupCommandPreExecute(command);

            let executeResult: ICommandResult = await command.execute(this, msg);

            if (executeResult.status === CommandResultStatus.error) {
                throw executeResult;
            }

            return executeResult;
        } else {
            throw permissionCommandResult;
        }
    }

    protected handleLackPermissionReply(commandPermissions: ICommandPermissions, msg: Message): void {
        let messengerService: MessengerService = new MessengerService();
        let replyMessage: string = commandPermissions.getPermissionFailReplyText(CommandInputContext.message, msg, null);
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
    }

    protected handleLackPermissionDeleteMessage(permissionResult: CommandPermissionResult, msg: Message): void {
        for (let failedRequirement of permissionResult.failedCommandRequirements) {
            if (failedRequirement.deleteMessageIfFail && msg.deletable) {
                msg.delete();
                break;
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
    }
}
