import { Provider } from 'nconf';
import { LoggerInstance } from 'winston';
import { IDiscordBot } from '../../main';
import { GuildMember, VoiceChannel, VoiceConnection, StreamDispatcher } from 'discord.js';
import * as fs from 'fs';
// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';

export class PlaySoundServiceResult {
    public isSuccess: boolean = false;
    public message: string = '';
    public streamDispatcher: StreamDispatcher = null;
    public onChannelErrorSubject: Rx.Subject<any> = new Rx.Subject<any>();
    public onSoundFinishSubject: Rx.Subject<boolean> = new Rx.Subject<boolean>();
    public onSoundErrorSubject: Rx.Subject<any> = new Rx.Subject<any>();

    // tslint:disable-next-line:function-name
    public static buildSimpleError(message: string): PlaySoundServiceResult {
        let errorResult: PlaySoundServiceResult = new PlaySoundServiceResult();
        errorResult.message = message;
        errorResult.isSuccess = false;

        return errorResult;
    } 
}

export class PlaySoundService {
    private configProvider: Provider;
    private logger: LoggerInstance;

    public constructor(configProvider: Provider, logger: LoggerInstance) {
        this.configProvider = configProvider;
        this.logger = logger;
    }

    public playSoundFromFile(bot: IDiscordBot, voiceChannel: VoiceChannel, file: string): Promise<PlaySoundServiceResult> {
        return new Promise<PlaySoundServiceResult>((resolve : (val: PlaySoundServiceResult) => void, 
                                                    reject : (val: PlaySoundServiceResult) => void) => {
            let result: PlaySoundServiceResult = new PlaySoundServiceResult();
            this.logger.debug('Trying to play sound file ' + file);

            if (!fs.existsSync(file)) {
                reject(PlaySoundServiceResult.buildSimpleError('File does not exist'));

                return;
            }

            voiceChannel.join().then((voiceConn: VoiceConnection) => {
                voiceConn.on('error', (err: Error) => {
                    result.onChannelErrorSubject.next(err);
                });

                voiceConn.on('failed', (err: Error) => {
                    result.onChannelErrorSubject.next(err);
                });

                voiceConn.on('warn', (warning: string | Error) => {
                    this.logger.warn('Warning from discord.js when in voice channel: ' + warning);
                });

                result.onSoundErrorSubject.subscribe((soundErr: any) => {
                    voiceConn.disconnect();
                });

                result.onSoundFinishSubject.subscribe((soundFinish: boolean) => {
                    voiceConn.disconnect();
                });

                result.streamDispatcher = voiceConn.playFile(file);
                result.streamDispatcher.once('end', () => {
                    result.onSoundFinishSubject.next(true);
                });
                result.streamDispatcher.once('error', (soundDispatchErr: Error) => {
                    try {
                        result.streamDispatcher.end();
                    } catch (tryEndErr) {
                        this.logger.error('Error ending stream dispatcher on the sound being played erroring out. Sound dispatch error: ' 
                                            + soundDispatchErr);
                    }
                    result.onSoundErrorSubject.next(soundDispatchErr);
                });

                resolve(result);
            }).catch((voiceChannelErr: any) => {
                this.logger.error('Failed to connect to voice channel to play sound file ' + file + '. Error: ' + voiceChannelErr);
                reject(PlaySoundServiceResult.buildSimpleError('Error joining voice channel to play sound file'));
            });
        });
    }
}
