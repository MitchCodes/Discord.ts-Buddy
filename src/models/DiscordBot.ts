// tslint:disable-next-line:no-submodule-imports
import { BitFieldResolvable, IntentsString } from 'discord.js';
import * as Rx from 'rxjs/Rx';
import { ILogger } from 'tsdatautils-core';

export interface IDiscordBot {
    name: string;
    color: number;
    logger: ILogger;

    setupBot(): void;
    startBot(intents: BitFieldResolvable<IntentsString, number>): Promise<string>;
    stopBot(): Promise<string>;
    getStatus(): BotStatus;
    setStatus(status: BotStatus): void;
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
