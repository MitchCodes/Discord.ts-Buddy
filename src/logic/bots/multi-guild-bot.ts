import { Logger, createLogger, transports } from 'winston';
import { Provider } from 'nconf';
import { IDiscordBot, BotStatus, IAutoManagedBot } from '../../models/DiscordBot';
import { ICommandPermissions, CommandPermissionFeedbackType, CommandPermissionResult, 
        CommandPermissionResultStatus } from '../../models/CommandPermission';
import { Client, Guild, Message, TextChannel, VoiceChannel } from 'discord.js';

// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { CommandParser } from '../command.logic';
import { ICommand, ICommandResult, CommandResult, CommandResultStatus } from '../../models/Command';
import { CommandPermissionsService } from '../services/permissions.service';
import { MessengerService } from '../services/messenger.service';
import { GuildCollection } from '../../main';
import { VoiceChannelManager } from '../voicechannel.logic';
import { ErrorWithCode } from '../../models/Errors';

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
    private voiceChannelManagers: GuildCollection<VoiceChannelManager> = new GuildCollection();

    constructor(passedBotName: string, passedBotToken: string, passedLogger: Logger, 
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
            this.botClient.destroy();
            this.botInfo('Stopped.');
            this.onBotLoggedOut.next(true);
            resolve('stopped');
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

    public getVoiceChannelManager(guild: Guild): VoiceChannelManager {
        let manager: VoiceChannelManager = this.voiceChannelManagers.item(guild);
        if (manager === undefined || manager === null) {
            manager = new VoiceChannelManager(this.logger, this.conf);
            this.voiceChannelManagers.add(guild, manager);
        }

        return manager;
    }

    // tslint:disable-next-line:no-empty
    protected setupCommandPreExecute(command: ICommand): void {
    }

    protected handleMessage(msg: Message): void {
        for (let commandParser of this.commandParsers) {
            let command: ICommand = commandParser.parseCommand(msg.content);
            if (command !== null) {
                this.handleCommand(command, msg).catch((cmdErr: ICommandResult) => {
                    this.botError('Error processing command ' + command.commandName + ': ' 
                                    + cmdErr.error + ' - Message: ' + cmdErr.message);
                });
            }
        }
    }

    protected handleCommand(command: ICommand, msg: Message): Promise<ICommandResult> {
        return new Promise<ICommandResult>((resolve : (val: ICommandResult) => void, reject : (val: ICommandResult) => void) => {
            // handle permissions
            let commandAny: any = <any>command;

            let permissionPromise: Promise<boolean> = new Promise<boolean>((resolve : (val: boolean) => void, reject : (val: any) => void) => {
                if (commandAny.permissionRequirements !== undefined && commandAny.permissionRequirements !== null) {
                    let commandPermissions = <ICommandPermissions>commandAny;
                    commandPermissions.setupPermissions(this, msg);
                    let permissionService: CommandPermissionsService = new CommandPermissionsService();
                    
                    permissionService.hasPermissions(commandPermissions, msg).then((permissionResult: CommandPermissionResult) => {
                        if (permissionResult.permissionStatus === CommandPermissionResultStatus.noPermission) {
                            let result: CommandResult = new CommandResult();
                            result.replyHandled = true;
                            result.error = new Error('Lack of permissions');
                            result.message = 'Lack permission to run this';
                            result.status = CommandResultStatus.error;
                            this.botInfo('User ' + msg.member.user.username + ' tried to run command ' + command.commandName 
                                        + '(' + msg.content + ') and lacked permission.');
                            this.handleLackPermissionReply(commandPermissions, msg);
                            this.handleLackPermissionDeleteMessage(permissionResult, msg);
                            reject(result);

                            return;
                        }
    
                        resolve(true);
                    });
                } else {
                    resolve(true);
                }
            });

            permissionPromise.then(() => {
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
            }).catch((err: any) => {
                // no permission result or error
                reject(err);
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
        this.guilds = this.botClient.guilds.cache.array();
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
