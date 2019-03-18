import { VoiceChannel, VoiceConnection, StreamDispatcher, VoiceReceiver } from 'discord.js';
// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { LoggerInstance } from 'winston';
import { Provider } from 'nconf';
import { ErrorWithCode } from '../models/Errors';
import { VoiceErrorCodes } from '../models/Voice';
import * as fs from 'fs';

export interface BasicDictionary<T> {
    [K: string]: T;
}

export class StreamDispatcherError {
    public dispatcher: StreamDispatcher;
    public error: any;
}

export class PlaySoundResult {
    public isSuccess: boolean = false;
    public message: string = '';
    public code: string = '';
    public streamDispatcher: StreamDispatcher = null;
    public onSoundFinishSubject: Rx.Subject<StreamDispatcher> = new Rx.Subject<StreamDispatcher>();
    public onSoundErrorSubject: Rx.Subject<StreamDispatcherError> = new Rx.Subject<StreamDispatcherError>();
}

export class VoiceChannelManager {
    public autoDisconnect: boolean = false;
    public allowPlayNewFiles: boolean = true;
    public onConnectionErrorSubject: Rx.Subject<Error> = new Rx.Subject<Error>();
    public onConnectionDisconnectSubject: Rx.Subject<VoiceConnection> = new Rx.Subject<VoiceConnection>();
    private logger: LoggerInstance = null;
    private configProvider: Provider = null;
    private activeVoiceChannel: VoiceChannel = null;
    private activeVoiceConnection: VoiceConnection = null;
    private activeVoiceReceivers: VoiceReceiver[] = [];
    private streamDispatchers: BasicDictionary<StreamDispatcher> = {};
    private get isActive(): boolean {
        return (this.activeVoiceConnection !== undefined && this.activeVoiceConnection !== null);
    }

    public constructor(logger: LoggerInstance, configProvider: Provider) {
        this.logger = logger;
        this.configProvider = configProvider;
        this.setupBasicSubscribers();
    }

    /**
     * Joins a voice channel if this manager is not already in one.
     * 
     * @param {VoiceChannel} voiceChannel 
     * @param {boolean} [autoDisconnect=false] Setting this to true will automatically disconnect the bot from the stream if all the stream dispatchers finish.
     * @returns {(Promise<VoiceConnection | any>)} 
     * @memberof VoiceChannelManager
     */
    public joinChannel(voiceChannel: VoiceChannel, autoDisconnect: boolean = false): Promise<VoiceConnection | any> {
        if (this.isActive) {
            if (this.isInChannel(voiceChannel)) {
                return Promise.resolve(this.activeVoiceConnection);
            }

            return Promise.reject(new Error('This manager is already handling another voice channel'));
        }

        return new Promise<VoiceConnection | any>((resolve : (val: VoiceConnection) => void, reject : (val: any) => void) => {
            this.activeVoiceChannel = voiceChannel;
            this.autoDisconnect = autoDisconnect;
            this.activeVoiceReceivers = [];
            this.activeVoiceChannel.join().then((res: VoiceConnection) => {
                this.activeVoiceConnection = res;

                this.activeVoiceConnection.on('error', (err: Error) => {
                    this.logger.error('Error (error event) during voice connection: ' + err);
                    this.onConnectionErrorSubject.next(err);
                });

                this.activeVoiceConnection.on('failed', (err: Error) => {
                    this.logger.error('Error (failed event) during voice connection: ' + err);
                    this.onConnectionErrorSubject.next(err);
                });

                this.activeVoiceConnection.on('warn', (warning: string | Error) => {
                    this.logger.warn('Warning from discord.js when in voice channel: ' + warning);
                });

                resolve(this.activeVoiceConnection);
            }).catch((voiceErr: any) => {
                reject(voiceErr);
            });
        });
    }

    public isInChannel(voiceChannel: VoiceChannel): boolean {
        return this.isInChannelById(voiceChannel.id);
    }

    public isInChannelById(voiceChannelId: string): boolean {
        if (this.isActive && this.activeVoiceChannel !== undefined && this.activeVoiceChannel !== null 
            && this.activeVoiceChannel.id === voiceChannelId) {
            return true;
        }

        return false;
    }

    public playLocalFile(file: string): Promise<PlaySoundResult | ErrorWithCode> {
        if (!this.allowPlayNewFiles) {
            return Promise.reject(ErrorWithCode.buildSimpleError(VoiceErrorCodes.CANNOT_PLAY_FILE_NOW, 'This manager is configured to not allow new files to play now'));
        }

        if (!this.isActive) {
            return Promise.reject(ErrorWithCode.buildSimpleError(VoiceErrorCodes.NO_CONNECTION, 'This manager is not connected to a voice channel'));
        }

        if (this.isPlayingFile(file)) {
            return Promise.reject(ErrorWithCode.buildSimpleError(VoiceErrorCodes.ALREADY_PLAYING_FILE, 'Cannot play this sound because it is already playing'));
        }

        if (!fs.existsSync(file)) {
            return Promise.reject(ErrorWithCode.buildSimpleError(VoiceErrorCodes.NO_FILE, 'File not found', new Error('Sound file ' + file + ' not found')));
        }

        return new Promise<PlaySoundResult | ErrorWithCode>((resolve : (val: PlaySoundResult) => void, reject : (val: ErrorWithCode) => void) => {
            let playSoundResult: PlaySoundResult = new PlaySoundResult();
            playSoundResult.onSoundFinishSubject = new Rx.Subject<StreamDispatcher>();
            playSoundResult.onSoundErrorSubject = new Rx.Subject<StreamDispatcherError>();
            let dispatchKey: string = file;

            playSoundResult.onSoundErrorSubject.subscribe((soundErr: StreamDispatcherError) => {
                this.handleStreamDispatcherEnd(file);
            });
            playSoundResult.onSoundFinishSubject.subscribe((soundFinish: StreamDispatcher) => {
                this.handleStreamDispatcherEnd(file);
            });
            
            let createdDispatcher: StreamDispatcher = this.activeVoiceConnection.playFile(file);
            this.streamDispatchers[file] = createdDispatcher;
            playSoundResult.streamDispatcher = createdDispatcher;
            playSoundResult.streamDispatcher.once('end', () => {
                playSoundResult.onSoundFinishSubject.next(playSoundResult.streamDispatcher);
            });
            playSoundResult.streamDispatcher.once('error', (soundDispatchErr: Error) => {
                try {
                    playSoundResult.streamDispatcher.end();
                } catch (tryEndErr) {
                    this.logger.error('Error ending stream dispatcher on the sound being played erroring out. Sound dispatch error: ' 
                                        + soundDispatchErr);
                }
                let streamDispatcherError: StreamDispatcherError = new StreamDispatcherError();
                streamDispatcherError.dispatcher = playSoundResult.streamDispatcher;
                streamDispatcherError.error = soundDispatchErr;
                playSoundResult.onSoundErrorSubject.next(streamDispatcherError);
            });

            resolve(playSoundResult);
        });
    }

    public isPlayingFile(file: string): boolean {
        let streamDispatcher: StreamDispatcher = this.streamDispatchers[file];
        if (streamDispatcher !== undefined && streamDispatcher !== null) {
            if (streamDispatcher.destroyed) {
                this.logger.error('Error! There should be no scenario when file\'s (' + file + ') stream is destroyed but still in the dictionary.');
            }

            return true;
        }

        return false;
    }

    public getReceiver(): Promise<VoiceReceiver | Error> {
        if (!this.isActive) {
            return Promise.reject(new Error('This manager is not connected to a voice channel'));
        }

        return new Promise<VoiceReceiver | Error>((resolve : (val: VoiceReceiver) => void, reject : (val: Error) => void) => {
            let newVoiceReceiver: VoiceReceiver = this.activeVoiceConnection.createReceiver();
            this.activeVoiceReceivers.push(newVoiceReceiver);
            if (this.activeVoiceReceivers.length > 1) {
                this.logger.warn('Discord.js only recommends creating one voice receiver per voice connection.');
            }

            resolve(newVoiceReceiver);
        });
    }

    public leaveChannel(): Promise<boolean | Error> {
        if (!this.isActive) {
            this.resetActiveVoiceSettings();

            return Promise.reject(new Error('This manager is not connected to a voice channel'));
        }

        return new Promise<boolean | Error>((resolve : (val: boolean) => void, reject : (val: Error) => void) => {
            let tempVoiceConnection: VoiceConnection = this.activeVoiceConnection;
            this.activeVoiceConnection.disconnect();
            this.resetActiveVoiceSettings();
            resolve(true);
            this.onConnectionDisconnectSubject.next(tempVoiceConnection);
        });
    }

    private setupBasicSubscribers(): void {
        this.onConnectionErrorSubject.subscribe((err: Error) => {
            this.leaveChannel().catch((leaveErr: Error) => {
                this.logger.error('Error leaving channel after encountering an error in (setupBasicSubscribers). Error: ' + leaveErr);
            });
        });
    }

    private handleStreamDispatcherEnd(key: string): void {
        let streamDispatcher: StreamDispatcher = this.streamDispatchers[key];
        if (streamDispatcher !== undefined && streamDispatcher !== null) {
            this.streamDispatchers[key] = undefined;
            delete this.streamDispatchers[key];

            if (this.autoDisconnect) {
                let dispatcherFiles: string[] = Object.keys(this.streamDispatchers);
                if (dispatcherFiles.length === 0) {
                    this.leaveChannel().catch((err: Error) => {
                        this.logger.error('Error leaving channel automatically when file ' + key + ' finished playing. Error: ' + err);
                    });
                }
            }
        }
    }

    private resetActiveVoiceSettings(): void {
        this.activeVoiceChannel = null;
        this.activeVoiceReceivers = [];
        this.activeVoiceConnection = null;
    }
}