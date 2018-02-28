import { LoggerInstance } from 'winston';
import { Provider } from 'nconf';
import { IDiscordBot, BotStatus, IAutoManagedBot } from '../../models/DiscordBot';
import { ICommandPermissions, CommandPermissionFeedbackType } from '../../models/CommandPermission';
import { Client, Guild, Message, TextChannel } from 'discord.js';

// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { CommandParser } from '../command.logic';
import { ICommand, ICommandResult, CommandResult, CommandResultStatus } from '../../models/Command';
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
    public logger: LoggerInstance = null;
    protected conf: Provider = null;
    protected botToken: string = '';
    protected botClient: Client = null;
    protected status: BotStatus = BotStatus.inactive;
    protected commandParsers: CommandParser[] = [];

    constructor(passedBotName: string, passedBotToken: string, passedLogger: LoggerInstance, 
                passedConf: Provider) {
        this.name = passedBotName;
        this.botToken = passedBotToken;
        this.logger = passedLogger;
        this.conf = passedConf;

        this.subscribeToSubjects();
        this.setupBot();
    }

    public startBot(): Promise<string> {
        return new Promise<string>((resolve : (val: string) => void, reject : (val: string) => void) => {
            if (this.botToken === '') {
                this.botError('No token found');
                reject('No token found');

                return;
            }
    
            this.botClient = new Client();
            this.setupBotEvents();
            this.botClient.login(this.botToken).then(() => {
                this.botInfo('Logged in.');
                this.onBotLoggedIn.next(true);
                resolve('logged in');
            }).catch((err: any) => {
                this.botError('Error logging in bot: ' + err);
                reject('Error logging in: ' + err);
            });
        });
    }

    public stopBot(): Promise<string> {
        return new Promise<string>((resolve : (val: string) => void, reject : (val: string) => void) => {
            this.botClient.destroy().then(() => {
                this.botInfo('Stopped.');
                this.onBotLoggedOut.next(true);
                resolve('stopped');
            }).catch((stopErr: string) => {
                this.botError('Error trying to stop the bot: ' + stopErr);
                this.onBotLoggedOut.next(true);
                reject(stopErr);
            });
        });
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

    protected handleMessage(msg: Message): void {
        for (let commandParser of this.commandParsers) {
            let command: ICommand = commandParser.parseCommand(msg.content);
            if (command !== null) {
                this.handleCommand(command, msg);
            }
        }
    }

    protected handleCommand(command: ICommand, msg: Message): Promise<ICommandResult> {
        return new Promise<ICommandResult>((resolve : (val: ICommandResult) => void, reject : (val: ICommandResult) => void) => {
            // handle permissions
            let commandAny: any = <any>command;
            if (commandAny.permissionSettings !== undefined) {
                let commandPermissions = <ICommandPermissions>commandAny;
                let permissionService: CommandPermissionsService = new CommandPermissionsService();
                
                let hasPermissions: boolean = permissionService.hasPermissions(commandPermissions, msg);

                if (!hasPermissions) {
                    let result: CommandResult = new CommandResult();
                    result.replyHandled = true;
                    result.error = new Error('Lack of permissions');
                    result.message = 'Lack permission to run this';
                    result.status = CommandResultStatus.error;
                    this.botInfo('User ' + msg.member.user.username + ' tried to run command ' + command.commandName 
                                + '(' + msg.content + ') and lacked permission.');
                    this.handleLackPermissionReply(commandPermissions, msg);
                    reject(result);

                    return;
                }
            }

            // they have permission, run the command
            this.setupCommandPreExecute(command);
            command.execute(this, msg).then((executeResult: ICommandResult) => {
                if (executeResult.status === CommandResultStatus.error) {
                    reject(executeResult);
    
                    return;
                }

                resolve(executeResult);
            }).catch((executeResult: ICommandResult) => {
                reject(executeResult);

                return;
            });
        });
    }

    protected handleLackPermissionReply(commandPermissions: ICommandPermissions, msg: Message): void {
        let messengerService: MessengerService = new MessengerService();
        let replyMessage: string = commandPermissions.getPermissionFailReplyText(msg);
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
        this.guilds = this.botClient.guilds.array();
    }

    private setupBotEvents(): void {
        this.botClient.on('message', (message: Message) => {
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