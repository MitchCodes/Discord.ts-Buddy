/* eslint-disable @typescript-eslint/no-unused-vars */
import { IDiscordBot, BotStatus, IAutoManagedBot } from '../models/DiscordBot';
import { BotRestartSettings } from '../models/BotRestartSettings';
// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { Logger } from 'winston';
import { BitFieldResolvable, IntentsString } from 'discord.js';

export class BotManager<T extends IDiscordBot & IAutoManagedBot> {
    public onBotMaxRestartAttempts: Rx.Subject<boolean> = new Rx.Subject<boolean>();
    public bot: T = null;
    private botStartAttempts: number = 0;
    private botRestartSettings: BotRestartSettings = null;
    private logger: Logger = null;
    
    public constructor(bot: T, botRestartSettings: BotRestartSettings, logger: Logger) {
        this.bot = bot;
        this.botRestartSettings = botRestartSettings;
        this.logger = logger;

        this.subscribeToSubjects();
    }

    /// This function assumes success. We are letting this manager handle the stopping and starting of bots.
    public startBot(isRestart: boolean = false, intents: BitFieldResolvable<IntentsString, number> = null): void {
        if (this.bot.getStatus() === BotStatus.active) {
            this.logger.info('Bot \'' + this.bot.name + '\' is already logged in and there is no point to starting it.');

            return;
        }

        this.botStartAttempts = this.botStartAttempts + 1;
        if (this.botRestartSettings.restart && this.botStartAttempts > this.botRestartSettings.restartMaxAttempts) {
            this.onBotMaxRestartAttempts.next(true);

            return;
        }

        this.bot.startBot(intents).then(() => {
            if (isRestart) {
                this.logger.info('Bot \'' + this.bot.name + '\' has successfully started/restarted on attempt #' + this.botStartAttempts);
            }
            this.resetRestartAttempts();
        }).catch((err: string) => {
            if (this.botRestartSettings.restart) {
                this.logger.error('Bot \'' + this.bot.name + '\' has failed to login.' + 
                                ' The bot will attempt to login again in ' + this.botRestartSettings.restartWaitMilliSeconds + 
                                ' milliseconds. Error: ' + err);
                this.restartBot();
            } else {
                this.logger.error('FATAL: Bot \'' + this.bot.name + '\' has failed to login' +
                    ' and is not set to restart. This bot will no longer restart. Error: ' + err);
                this.resetRestartAttempts();
            }
        });
    }

    /// This function assumes success. We are letting this manager handle the stopping and starting of bots.
    public stopBot(): void {
        if (this.bot.getStatus() === BotStatus.inactive) {
            this.logger.info('Bot \'' + this.bot.name + '\' is already stopped and there is no point to stopping it.');

            return;
        }

        this.bot.stopBot();
        this.resetRestartAttempts();
    }

    private cooldownAndRestart() {
        this.logger.error('Bot \'' + this.bot.name + '\' has failed to start ' + this.botRestartSettings.restartMaxAttempts 
                        + ' times and is going to try again in ' + this.botRestartSettings.cooldownMilliseconds + ' milliseconds.');
        this.resetRestartAttempts();
        this.bot.setStatus(BotStatus.restartCooldown);
        setTimeout(() => {
            this.bot.setStatus(BotStatus.inactive);
            this.startBot();
        },         this.botRestartSettings.cooldownMilliseconds);
    }

    private restartBot(): void {
        let stopBotFunc: any = () => {
            this.startBot(true);
        };

        setTimeout(() => {
            this.bot.stopBot().then(stopBotFunc).catch(stopBotFunc);
        },         this.botRestartSettings.restartWaitMilliSeconds);
    }

    private resetRestartAttempts(): void {
        this.botStartAttempts = 0;
    }

    private subscribeToSubjects(): void {
        this.onBotMaxRestartAttempts.subscribe(() => {
            if (this.botRestartSettings.cooldownAfterMaxAttempts) {
                this.cooldownAndRestart();
            } else {
                this.bot.setStatus(BotStatus.inactive);
                this.logger.error('FATAL: Bot \'' + this.bot.name + '\' has failed to login' +
                    ' and the maximum number of restart attempts has been reached. The bot is not' +
                    ' set to try again after a cooldown period and will no longer try to start-up.');
                this.resetRestartAttempts();
            }
        });

        this.bot.onBotRequiresRestart.subscribe(() => {
            if (this.botRestartSettings.restart) {
                this.restartBot();
            }
        });
    }
    
}
