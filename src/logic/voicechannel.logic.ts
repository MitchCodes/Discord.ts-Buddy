import { VoiceChannel, VoiceConnection, StreamDispatcher, VoiceReceiver } from 'discord.js';
// tslint:disable-next-line:no-submodule-imports
import * as Rx from 'rxjs/Rx';
import { Logger, createLogger, transports } from 'winston';
import { Provider } from 'nconf';
import { ErrorWithCode } from '../models/Errors';
import { VoiceErrorCodes } from '../models/Voice';
import * as fs from 'fs';
import { Readable } from 'stream';
import { clearTimeout, setTimeout } from 'timers';

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
    public allowPlayNew: boolean = true;
    public leaveChannelFailTimerMs: number = 15000;
    public onConnectionErrorSubject: Rx.Subject<Error> = new Rx.Subject<Error>();
    public onConnectionDisconnectSubject: Rx.Subject<VoiceConnection> = new Rx.Subject<VoiceConnection>();
    private logger: Logger = null;
    private configProvider: Provider = null;
    private activeVoiceChannel: VoiceChannel = null;
    private activeVoiceConnection: VoiceConnection = null;
    private activeVoiceReceivers: VoiceReceiver[] = [];
    private streamDispatchers: BasicDictionary<StreamDispatcher> = {};
    private connectionDisconnections: BasicDictionary<boolean> = {};

    private get isActive(): boolean {
        return (this.activeVoiceConnection !== undefined && this.activeVoiceConnection !== null);
    }

    public constructor(logger: Logger, configProvider: Provider) {
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
            this.autoDisconnect = autoDisconnect;
            this.activeVoiceReceivers = [];
            voiceChannel.join().then((res: VoiceConnection) => {
                this.activeVoiceChannel = voiceChannel;
                this.activeVoiceConnection = res;

                this.activeVoiceConnection.on('error', (err: Error) => {
                    this.logger.error('Error (error event) during voice connection: Error (' + err.name + '): ' + err.message + ', Stack: ' + err.stack);
                    this.onConnectionErrorSubject.next(err);
                });

                this.activeVoiceConnection.on('failed', (err: Error) => {
                    this.logger.error('Error (failed event) during voice connection: Error (' + err.name + '): ' + err.message + ', Stack: ' + err.stack);
                    this.onConnectionErrorSubject.next(err);
                });

                this.activeVoiceConnection.on('warn', (warning: string | Error) => {
                    if (warning instanceof Error) {
                        this.logger.error('Warning with error from discord.js when in voice channel: Error (' + warning.name + '): ' + warning.message + ', Stack: ' + warning.stack);
                    } else {
                        this.logger.warn('Warning from discord.js when in voice channel: ' + warning);
                    }
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

    public playStream(stream: Readable, timeoutMs: number = -1): Promise<PlaySoundResult | ErrorWithCode> {
        if (!this.allowPlayNew) {
            return Promise.reject(ErrorWithCode.buildSimpleError(VoiceErrorCodes.CANNOT_PLAY_STREAM_NOW, 'This manager is configured to not allow new sounds to play now'));
        }

        if (!this.isActive) {
            return Promise.reject(ErrorWithCode.buildSimpleError(VoiceErrorCodes.NO_CONNECTION, 'This manager is not connected to a voice channel'));
        }

        return new Promise<PlaySoundResult | ErrorWithCode>((resolve : (val: PlaySoundResult) => void, reject : (val: ErrorWithCode) => void) => {
            let playSoundResult: PlaySoundResult = new PlaySoundResult();
            playSoundResult.onSoundFinishSubject = new Rx.Subject<StreamDispatcher>();
            playSoundResult.onSoundErrorSubject = new Rx.Subject<StreamDispatcherError>();
            let dispatchKey: string = this.uuidv4();

            let createdDispatcher: StreamDispatcher = this.activeVoiceConnection.play(stream);
            this.streamDispatchers[dispatchKey] = createdDispatcher;
            playSoundResult.streamDispatcher = createdDispatcher;
            
            this.setupStreamDispatcherLifecycle(dispatchKey, createdDispatcher, playSoundResult.onSoundFinishSubject, playSoundResult.onSoundErrorSubject, true, timeoutMs);

            resolve(playSoundResult);
        });
    }

    public playLocalFile(file: string, timeoutMs: number = -1): Promise<PlaySoundResult | ErrorWithCode> {
        if (!this.allowPlayNew) {
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
            
            let createdDispatcher: StreamDispatcher = this.activeVoiceConnection.play(file);
            this.streamDispatchers[dispatchKey] = createdDispatcher;
            playSoundResult.streamDispatcher = createdDispatcher;

            this.setupStreamDispatcherLifecycle(dispatchKey, createdDispatcher, playSoundResult.onSoundFinishSubject, playSoundResult.onSoundErrorSubject, false, timeoutMs);

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
            let newVoiceReceiver: VoiceReceiver = this.activeVoiceConnection.receiver;
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

        if (this.activeVoiceConnection === undefined || this.activeVoiceConnection === null) {
            this.resetActiveVoiceSettings();
            return Promise.reject(new Error('This manager does not have an active voice connection'));
        }

        return new Promise<boolean | Error>((resolve : (val: boolean) => void, reject : (val: Error) => void) => {
            let tempVoiceConnection: VoiceConnection = this.activeVoiceConnection;

            let leaveTimer: NodeJS.Timer = setTimeout(() => {
                reject(new Error('The bot has failed to disconnect within ' + this.leaveChannelFailTimerMs + ' milliseconds.'));
                this.resetActiveVoiceSettings();
                leaveTimer = null;
            }, 15000);

            tempVoiceConnection.on('disconnect', () => {
                if (leaveTimer !== undefined && leaveTimer !== null) {
                    clearTimeout(leaveTimer);
                    leaveTimer = null;
                }

                this.resetActiveVoiceSettings();
                this.onConnectionDisconnectSubject.next(tempVoiceConnection);
                resolve(true);
            });

            this.activeVoiceConnection.disconnect();
        });
    }

    private setupStreamDispatcherLifecycle(dispatcherKey: string, dispatcher: StreamDispatcher, finishSubject: Rx.Subject<StreamDispatcher>, errorSubject: Rx.Subject<StreamDispatcherError>, isStream: boolean = false, timeoutMs: number = -1): void {
        let errorSubscription: Rx.Subscription = null;
        let finishSubscription: Rx.Subscription = null;
        let timer: NodeJS.Timer = null;

        finishSubscription = finishSubject.subscribe((soundFinish: StreamDispatcher) => {
            this.handleStreamDispatcherEnd(dispatcherKey, isStream, timer);
            finishSubscription.unsubscribe();
        });

        errorSubscription = errorSubject.subscribe((soundErr: StreamDispatcherError) => {
            if (!finishSubscription.closed) {
                finishSubscription.unsubscribe();
            }
            try {
                dispatcher.end();
            } catch (tryEndErr) {
                this.logger.error('Error ending dispatcher on the sound being played erroring out. Sound dispatch error: ' 
                                    + soundErr.error);
            }

            this.handleStreamDispatcherEnd(dispatcherKey, isStream, timer);
            errorSubscription.unsubscribe();
        });

        if (timeoutMs > 0) {
            timer = setTimeout(() => {
                let streamDispatcherError: StreamDispatcherError = new StreamDispatcherError();
                streamDispatcherError.dispatcher = dispatcher;
                streamDispatcherError.error = new Error('Timeout period of ' + timeoutMs + ' milliseconds reached in stream dispatcher.');

                timer = null;

                errorSubject.next(streamDispatcherError);
            }, timeoutMs);
        }

        dispatcher.on('debug', (msg: string) => {
            this.logger.debug('StreamDispatcher Debug for key ' + dispatcherKey + ': ' + msg);
        });
        
        dispatcher.once('end', () => {
            finishSubject.next(dispatcher);
        });

        dispatcher.once('error', (soundDispatchErr: Error) => {
            this.logger.error('Error in voice channel manager stream dispatch: Error (' + soundDispatchErr.name + '): ' + soundDispatchErr.message + ', Stack: ' + soundDispatchErr.stack);
            let streamDispatcherError: StreamDispatcherError = new StreamDispatcherError();
            streamDispatcherError.dispatcher = dispatcher;
            streamDispatcherError.error = soundDispatchErr;
            errorSubject.next(streamDispatcherError);
        });
    }

    private setupBasicSubscribers(): void {
        this.onConnectionErrorSubject.subscribe((err: Error) => {
            this.logger.error('Error on voice channel connection. Error (' + err.name + '): ' + err.message + ', Stack: ' + err.stack);
            this.leaveChannel().catch((leaveErr: Error) => {
                this.logger.error('Error leaving channel after encountering an error in (setupBasicSubscribers). Error: ' + leaveErr);
            });
            
        });
    }

    private handleStreamDispatcherEnd(key: string, isStream: boolean = false, timeoutTimer: NodeJS.Timer = null): void {
        if (timeoutTimer !== undefined && timeoutTimer !== null) {
            clearTimeout(timeoutTimer);
        }

        let streamDispatcher: StreamDispatcher = this.streamDispatchers[key];
        if (streamDispatcher !== undefined && streamDispatcher !== null) {
            this.streamDispatchers[key] = undefined;
            delete this.streamDispatchers[key];
        }

        if (this.autoDisconnect) {
            let dispatcherFiles: string[] = Object.keys(this.streamDispatchers);
            if (dispatcherFiles.length === 0) {
                this.leaveChannel().catch((err: Error) => {
                    if (isStream) {
                        this.logger.error('Error leaving channel automatically when stream ' + key + ' finished playing. Error (' + err.name + '): ' + err.message + ', Stack: ' + err.stack);
                    } else {
                        this.logger.error('Error leaving channel automatically when file ' + key + ' finished playing. Error (' + err.name + '): ' + err.message + ', Stack: ' + err.stack);
                    }
                });
            }
        }
    }

    private resetActiveVoiceSettings(): void {
        this.activeVoiceChannel = null;
        this.activeVoiceReceivers = [];
        this.activeVoiceConnection = null;
    }

    private uuidv4(): string {
        // tslint:disable-next-line:typedef no-function-expression
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            // tslint:disable-next-line:triple-equals no-bitwise no-var-keyword insecure-random one-variable-per-declaration
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            
            return v.toString(16);
        });
    }
}
