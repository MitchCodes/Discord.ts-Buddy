/* eslint-disable @typescript-eslint/no-unused-vars */
import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { VoiceChannel } from "discord.js";
import { Readable } from "stream";
import { IDiscordBot } from "../../models/DiscordBot";

export class SoundService {
    public getVoiceConnection(bot: IDiscordBot, guildId: string, destroyIfDisconnected: boolean = true): VoiceConnection {
        let connection: VoiceConnection = getVoiceConnection(guildId, bot.name);
        
        if (destroyIfDisconnected && connection && connection.state.status === VoiceConnectionStatus.Disconnected) {
            connection.destroy();
            connection = null;
        }

        return connection;
    }

    public isInVoiceChannel(bot: IDiscordBot, guildId: string): boolean {
        let connection: VoiceConnection = getVoiceConnection(guildId, bot.name);
        let hasConnection: boolean = false;

        if (connection && connection.state.status !== VoiceConnectionStatus.Disconnected) {
            hasConnection = true;
        }

        return hasConnection;
    }

    public async playSoundInChannel(bot: IDiscordBot, voiceChannel: VoiceChannel, audioInput: string | Readable): Promise<void> {
        if (voiceChannel && audioInput) {
            let audioResource: AudioResource = createAudioResource(audioInput);
            await this.playSoundInChannelInternal(bot.name, voiceChannel.guild.id, voiceChannel.id, voiceChannel.guild.voiceAdapterCreator, audioResource);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async playSoundInChannelInternal(groupId: string, guildId: string, channelId: string, adapterCreator: any, audioResource: AudioResource): Promise<void> {
        let voiceConnection: VoiceConnection = null;
        let audioPlayer: AudioPlayer = null;
        try {
            voiceConnection = joinVoiceChannel({
                channelId: channelId,
                guildId: guildId,
                adapterCreator: adapterCreator,
                group: groupId,
            });
            
            let voiceConnectionReady: Promise<void> = new Promise<void>((resolve, reject) => {
                let timeout: NodeJS.Timeout = setTimeout(() => {
                    reject('Voice connection timeout');
                }, 10000);
    
                voiceConnection.on(VoiceConnectionStatus.Ready, () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
    
            await voiceConnectionReady;
    
            
            audioPlayer = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });
    
            audioPlayer.on('error', error => {
                throw 'Audio player error: ' + error;
            });

            let disconnectionPromise: Promise<void> = new Promise<void>((resolve, reject) => {
                voiceConnection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                    try {
                        await Promise.race([
                            entersState(voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                        // Seems to be reconnecting to a new channel - ignore disconnect
                    } catch (error) {
                        // Seems to be a real disconnect which SHOULDN'T be recovered from
                        voiceConnection.destroy();
                        voiceConnection = null;
                        reject('Disconnection error: ' + error);
                    }
                });
            });
    
            let audioPlayerStartedPlaying: Promise<void> = new Promise<void>((resolve, reject) => {
                let timeout: NodeJS.Timeout = setTimeout(() => {
                    reject('Audio playing timeout');
                }, 10000);

                audioPlayer.on(AudioPlayerStatus.Playing, () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });

            if (audioPlayer && audioPlayer.playable && voiceConnection && voiceConnection.state.status === VoiceConnectionStatus.Ready) {
                audioPlayer.play(audioResource);

                voiceConnection.subscribe(audioPlayer);

                // wait for it to start playing, but if disconnection happens first reject 
                await Promise.race([audioPlayerStartedPlaying, disconnectionPromise]);

                let audioPlayerFinishedPlaying: Promise<void> = new Promise<void>((resolve) => {
                    audioPlayer.on(AudioPlayerStatus.Idle, () => {
                        resolve();
                    });
                });

                // wait for it to stop playing, but if disconnection happens first reject 
                await Promise.race([audioPlayerFinishedPlaying, disconnectionPromise]);

                audioPlayer.stop();
                voiceConnection.destroy();
            }            
        } catch (err) {
            if (audioPlayer) {
                audioPlayer.stop();
            }
            
            if (voiceConnection) {
                voiceConnection.destroy();
            }

            throw err;
        }        
    }
}