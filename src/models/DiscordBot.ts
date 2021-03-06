// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { Logger, createLogger, transports } from 'winston';

export interface IDiscordBot {
    name: string;
    color: number;
    logger: Logger;

    setupBot(): void;
    startBot(): Promise<string>;
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
