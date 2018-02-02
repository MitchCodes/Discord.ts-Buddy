export class BotRestartSettings {
    public restart: boolean = true;
    public restartWaitMilliSeconds: number = 10000; // 10 seconds
    public restartMaxAttempts: number = 12; // 2 minutes worth of waiting
    public cooldownAfterMaxAttempts: boolean = true;
    public cooldownMilliseconds: number = 1800000; // 30 mins
}
