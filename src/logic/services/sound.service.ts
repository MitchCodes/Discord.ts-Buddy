/* eslint-disable @typescript-eslint/no-unused-vars */
import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, entersState, getVoiceConnection, joinVoiceChannel, NoSubscriberBehavior, StreamType, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { InternalDiscordGatewayAdapterCreator, VoiceChannel } from "discord.js";
import { Readable } from "stream";
import { IDiscordBot } from "../../models/DiscordBot";
import { ILogger } from "tsdatautils-core";

/**
 * SoundService - A robust service for playing audio in Discord voice channels
 * 
 * This service provides a comprehensive solution for Discord bot audio playback with:
 * - Robust error handling and detailed logging
 * - Automatic connection management and cleanup
 * - Support for both file paths and readable streams as audio input
 * - Proper resource cleanup to prevent memory leaks
 * - Graceful handling of voice connection interruptions
 * 
 * @example
 * ```typescript
 * // Create service with logger (recommended)
 * const soundService = new SoundService(bot.logger);
 * 
 * // Play a sound file
 * await soundService.playSoundInChannel(bot, voiceChannel, './audio/sound.mp3');
 * 
 * // Play from a stream
 * const stream = fs.createReadStream('./audio/music.ogg');
 * await soundService.playSoundInChannel(bot, voiceChannel, stream);
 * 
 * // Check if bot is connected to voice
 * const isConnected = soundService.isInVoiceChannel(bot, guildId);
 * ```
 * 
 * @since 1.3.44
 */
export class SoundService {
    private logger: ILogger;

    /**
     * Creates a new SoundService instance
     * 
     * @param logger Optional logger instance for detailed logging. If not provided, 
     *               the service will fall back to console logging.
     */
    constructor(logger?: ILogger) {
        this.logger = logger;
    }

    /**
     * Logs error messages with consistent formatting
     * @private
     */
    private logError(message: string, error?: Error): void {
        const fullMessage = `SoundService Error: ${message}`;
        if (this.logger) {
            this.logger.error(fullMessage + (error ? ` - ${error.message}` : ''));
            if (error && error.stack) {
                this.logger.error(`Stack trace: ${error.stack}`);
            }
        } else {
            console.error(fullMessage, error);
        }
    }

    /**
     * Logs warning messages with consistent formatting
     * @private
     */
    private logWarn(message: string): void {
        const fullMessage = `SoundService Warning: ${message}`;
        if (this.logger) {
            this.logger.warn(fullMessage);
        } else {
            console.warn(fullMessage);
        }
    }

    /**
     * Logs info messages with consistent formatting
     * @private
     */
    private logInfo(message: string): void {
        const fullMessage = `SoundService: ${message}`;
        if (this.logger) {
            this.logger.info(fullMessage);
        } else {
            console.info(fullMessage);
        }
    }

    /**
     * Logs debug messages with consistent formatting
     * @private
     */
    private logDebug(message: string): void {
        const fullMessage = `SoundService: ${message}`;
        if (this.logger) {
            this.logger.debug(fullMessage);
        } else {
            console.debug(fullMessage);
        }
    }

    /**
     * Retrieves the current voice connection for a bot in a specific guild
     * 
     * @param bot The Discord bot instance
     * @param guildId The ID of the guild to check for voice connection
     * @param destroyIfDisconnected Whether to destroy disconnected connections (default: true)
     * @returns The active voice connection, or null if none exists or parameters are invalid
     * 
     * @example
     * ```typescript
     * const connection = soundService.getVoiceConnection(bot, '123456789', true);
     * if (connection) {
     *     console.log('Bot is connected to voice');
     * }
     * ```
     */
    public getVoiceConnection(bot: IDiscordBot, guildId: string, destroyIfDisconnected: boolean = true): VoiceConnection {
        try {
            if (!bot) {
                this.logError("Bot parameter is null or undefined");
                return null;
            }

            if (!guildId) {
                this.logError("GuildId parameter is null or undefined");
                return null;
            }

            let connection: VoiceConnection = getVoiceConnection(guildId, bot.name);
            
            if (destroyIfDisconnected && connection && connection.state.status === VoiceConnectionStatus.Disconnected) {
                this.logInfo(`Destroying disconnected voice connection for guild ${guildId}`);
                connection.destroy();
                connection = null;
            }

            if (connection && connection.state.status === VoiceConnectionStatus.Destroyed) {
                this.logInfo(`Voice connection already destroyed for guild ${guildId}`);
                connection = null;
            }

            return connection;
        } catch (error) {
            this.logError("Failed to get voice connection", error);
            return null;
        }
    }

    /**
     * Checks if the bot is currently connected to a voice channel in the specified guild
     * 
     * @param bot The Discord bot instance
     * @param guildId The ID of the guild to check
     * @returns true if bot is connected to voice, false otherwise
     * 
     * @example
     * ```typescript
     * if (soundService.isInVoiceChannel(bot, message.guild.id)) {
     *     await soundService.playSoundInChannel(bot, voiceChannel, audioFile);
     * } else {
     *     console.log('Bot is not in a voice channel');
     * }
     * ```
     */
    public isInVoiceChannel(bot: IDiscordBot, guildId: string): boolean {
        try {
            if (!bot) {
                this.logError("Bot parameter is null or undefined in isInVoiceChannel");
                return false;
            }

            if (!guildId) {
                this.logError("GuildId parameter is null or undefined in isInVoiceChannel");
                return false;
            }

            let connection: VoiceConnection = getVoiceConnection(guildId, bot.name);
            let hasConnection: boolean = false;

            if (connection && connection.state.status !== VoiceConnectionStatus.Disconnected && connection.state.status !== VoiceConnectionStatus.Destroyed) {
                hasConnection = true;
            }

            this.logInfo(`Voice channel status check for guild ${guildId}: ${hasConnection ? 'connected' : 'not connected'} (status: ${connection?.state?.status || 'no connection'})`);
            return hasConnection;
        } catch (error) {
            this.logError("Failed to check voice channel status", error);
            return false;
        }
    }

    /**
     * Plays audio in a Discord voice channel with comprehensive error handling
     * 
     * This method handles the complete audio playback lifecycle:
     * - Validates all input parameters
     * - Creates audio resources from files or streams
     * - Manages voice connection establishment
     * - Monitors playback status with timeouts
     * - Cleans up resources after completion or on error
     * 
     * @param bot The Discord bot instance
     * @param voiceChannel The voice channel to play audio in
     * @param audioInput Either a file path (string) or a readable stream containing audio data
     * 
     * @throws {Error} When any parameter is null/undefined
     * @throws {Error} When audio resource creation fails
     * @throws {Error} When voice adapter creator is unavailable
     * @throws {Error} When voice connection or audio playback fails
     * 
     * @example
     * ```typescript
     * try {
     *     // Play from file path
     *     await soundService.playSoundInChannel(bot, voiceChannel, './sounds/notification.mp3');
     *     
     *     // Play from stream
     *     const audioStream = fs.createReadStream('./music/song.ogg');
     *     await soundService.playSoundInChannel(bot, voiceChannel, audioStream);
     * } catch (error) {
     *     console.error('Failed to play sound:', error.message);
     * }
     * ```
     */
    public async playSoundInChannel(bot: IDiscordBot, voiceChannel: VoiceChannel, audioInput: string | Readable): Promise<void> {
        try {
            // Validate parameters
            if (!bot) {
                const error = new Error("Bot parameter is null or undefined");
                this.logError("playSoundInChannel failed: Bot parameter is null or undefined", error);
                throw error;
            }

            if (!voiceChannel) {
                const error = new Error("VoiceChannel parameter is null or undefined");
                this.logError("playSoundInChannel failed: VoiceChannel parameter is null or undefined", error);
                throw error;
            }

            if (!audioInput) {
                const error = new Error("AudioInput parameter is null or undefined");
                this.logError("playSoundInChannel failed: AudioInput parameter is null or undefined", error);
                throw error;
            }

            this.logInfo(`Starting sound playback in channel ${voiceChannel.name} (${voiceChannel.id}) for guild ${voiceChannel.guild.name} (${voiceChannel.guild.id})`);

            // Create audio resource with error handling
            let audioResource: AudioResource;
            try {
                audioResource = createAudioResource(audioInput, {
                    inputType: StreamType.Arbitrary
                });
                this.logInfo("Audio resource created successfully");
            } catch (resourceError) {
                const error = new Error(`Failed to create audio resource: ${resourceError.message}`);
                this.logError("Failed to create audio resource", error);
                throw error;
            }

            // Validate voice adapter creator
            if (!voiceChannel.guild.voiceAdapterCreator) {
                const error = new Error("Voice adapter creator is not available for this guild");
                this.logError("playSoundInChannel failed: Voice adapter creator is not available", error);
                throw error;
            }

            await this.playSoundInChannelInternal(bot.name, voiceChannel.guild.id, voiceChannel.id, voiceChannel.guild.voiceAdapterCreator, audioResource);
            this.logInfo("Sound playback completed successfully");
        } catch (error) {
            this.logError("playSoundInChannel failed", error);
            throw error;
        }
    }

    /**
     * Internal method that handles the complex voice connection and audio playback logic
     * 
     * This method manages the low-level Discord voice API operations:
     * - Establishes voice channel connection with timeout handling
     * - Creates and configures audio player with event monitoring
     * - Handles voice disconnection/reconnection scenarios
     * - Manages audio playback lifecycle with comprehensive error handling
     * - Ensures proper cleanup of all resources
     * 
     * @private
     * @param groupId Bot identifier for voice connection grouping
     * @param guildId Discord guild (server) ID
     * @param channelId Discord voice channel ID
     * @param adapterCreator Voice adapter creator function from Discord.js
     * @param audioResource Pre-created audio resource to play
     * 
     * @throws {Error} For any voice connection, audio player, or playback failures
     */
    private async playSoundInChannelInternal(groupId: string, guildId: string, channelId: string, adapterCreator: InternalDiscordGatewayAdapterCreator, audioResource: AudioResource): Promise<void> {
        let voiceConnection: VoiceConnection | undefined;
        let audioPlayer: AudioPlayer | undefined;
        
        try {
            // Step 1: Join the voice channel
            this.logInfo(`Attempting to join voice channel ${channelId} in guild ${guildId}`);

            voiceConnection = joinVoiceChannel({
                channelId: channelId,
                guildId: guildId,
                adapterCreator: adapterCreator,
                //group: groupId,
            });

            // Setup error handler for the voice connection
            voiceConnection.on('error', (error: Error) => {
                this.logError("Voice connection error", error);
            });

            this.logInfo(`Voice connection created for channel ${channelId} in guild ${guildId}`);


            // Step 2: Wait for voice connection to be ready
            await entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000);


            // Step 3: Create and configure the audio player
            this.logInfo("Creating audio player");
            audioPlayer = createAudioPlayer();
            this.logInfo("Audio player created successfully");

            // Add more audio player event logging
            audioPlayer.once(AudioPlayerStatus.Buffering, () => {
                this.logDebug("Audio player is buffering");
            });

            audioPlayer.on(AudioPlayerStatus.AutoPaused, () => {
                this.logWarn("Audio player was auto-paused (no subscribers?)");
            });


            // Step 4: Validate states before attempting playback
            if (!audioPlayer) {
                throw new Error("Cannot play audio: Audio player is null");
            }

            if (!audioPlayer.playable) {
                throw new Error("Cannot play audio: Audio player is not in a playable state");
            }

            if (!voiceConnection) {
                throw new Error("Cannot play audio: Voice connection is null");
            }

            if (voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
                throw new Error(`Cannot play audio: Voice connection is not ready. Current status: ${voiceConnection.state.status}`);
            }


            // Step 5: Start audio playback
            this.logInfo("Starting audio playback...");

            this.logInfo("Passing audio resource passed to player");
            audioPlayer.play(audioResource);
            this.logInfo("Audio resource passed to player successfully");

            this.logInfo("Voice connection subscribing to audio player");
            voiceConnection.subscribe(audioPlayer);
            this.logInfo("Voice connection successfully subscribed to audio player");


            // Step 6: Wait for audio to start playing (with disconnection monitoring)
            this.logInfo("Waiting for audio to start playing...");
            await entersState(audioPlayer, AudioPlayerStatus.Playing, 5_000);
            this.logInfo("Audio started playing successfully");


            // Step 7: Wait for audio playback to complete
            if (audioPlayer.state.status !== AudioPlayerStatus.Idle) {
                await new Promise<void>((resolve, reject) => {
                    // Called when the audio player goes to idle (completed playback)
                    audioPlayer.once(AudioPlayerStatus.Idle, () => resolve());

                    // Audio player error handling
                    audioPlayer.once('error', (error) => {
                        this.logError(`Audio player error: ${error.message}`, error);
                        reject(error);
                    });
                });
            }

            // Step 8: Clean up connection
            voiceConnection?.destroy();
        } catch (err) {
            this.logError("Critical error in playSoundInChannelInternal", err instanceof Error ? err : new Error(String(err)));
        
            // Clean up voice connection
            if (voiceConnection) {
                try {
                    voiceConnection.destroy();
                    this.logInfo("Voice connection destroyed during cleanup");
                } catch (destroyError) {
                    this.logError("Error destroying voice connection during cleanup", destroyError);
                }
            }

            // Re-throw the original error with proper type
            throw err instanceof Error ? err : new Error(String(err));
        }      
    }
}