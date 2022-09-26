// tslint:disable-next-line:no-submodule-imports
import { BitFieldResolvable, Client } from 'discord.js';
import * as Rx from 'rxjs/Rx';
import { ILogger } from 'tsdatautils-core';

export interface IDiscordBot {
    name: string;
    color: number;
    logger: ILogger;

    setupBot(): Promise<void>;
    startBot(intents: BitFieldResolvable<string, number>): Promise<string>;
    stopBot(): Promise<string>;
    getStatus(): BotStatus;
    setStatus(status: BotStatus): void;
}

export interface IExposedClientBot {
    getBotClient(): Client;
}

export interface IAutoManagedBot {
    onBotRequiresRestart: Rx.Subject<string>;
    restartBotDueToError(err: string): void;
}

export enum BotStatus {
    inactive = 0,
    active = 1,
    restartCooldown = 2,
}
