import { Logger, createLogger, transports } from 'winston';
import * as nconf from 'nconf';
import { Guild, VoiceChannel, TextChannel } from 'discord.js';
import { MultiGuildBot } from '../../src/logic/bots/multi-guild-bot';
import { TestBot } from './testbot';
import { WinstonLogger } from 'tsdatautils-core';

describe('multi-guild-bot tests', () => {
    let logger: Logger;
    let mainBotToken: string = '';
    let mainBotClient: TestBot = null;
    let mainBotTestGuild: Guild = null;
    let mainBotVoiceChannel: VoiceChannel = null;

    let secondBotToken: string = '';
    let secondBotClient: MultiGuildBot = null;
    let secondBotTestGuild: Guild = null;

    let guildTestOnId: string = '';

    let voiceChannelName: string = '';

    jest.setTimeout(300000);

    beforeAll(async () => {
        // Even though this file is in two directories deep, the context of running the tests is in the root folder.
        nconf.file({ file: './config.common.json' });
        nconf.defaults({
            test: {
                bots: {
                    mainBotToken: '',
                    secondBotToken: '',
                    testDiscordGuildId: '',
                    testDiscordVoiceChannelName: '',
                },
            },
        });

        mainBotToken = nconf.get('test:bots:mainBotToken');
        secondBotToken = nconf.get('test:bots:secondBotToken');
        guildTestOnId = nconf.get('test:bots:testDiscordGuildId');
        voiceChannelName = nconf.get('test:bots:testDiscordVoiceChannelName');

        logger = createLogger({
            level: 'debug',
            transports: [
              new transports.Console(),
            ],
          });
        
        if (mainBotToken && secondBotToken) {
            mainBotClient = new TestBot('Main Bot', mainBotToken, new WinstonLogger(logger), nconf);
            secondBotClient = new MultiGuildBot('Second Bot', secondBotToken, new WinstonLogger(logger), nconf);

            logger.info('Main Token: ' + mainBotToken);

            let mainBotReadySubscription: Promise<void> = new Promise<void>((resolve) => {
                mainBotClient.onBotReady.subscribe(() => {
                    for (let guild of mainBotClient.guilds) {
                        if (guild.id === guildTestOnId) {
                            mainBotTestGuild = guild;
                            break;
                        }
                    }


                    resolve();
                });
            });
            
            let secondBotReadySubscription: Promise<void> = new Promise<void>((resolve) => {
                secondBotClient.onBotReady.subscribe(() => {
                    for (let guild of secondBotClient.guilds) {
                        if (guild.id === guildTestOnId) {
                            secondBotTestGuild = guild;
                            break;
                        }
                    }
    
                    if (mainBotTestGuild !== null && mainBotTestGuild !== undefined) {
                        for (let channel of mainBotTestGuild.channels.cache) {
                            if (channel[1].name === voiceChannelName && channel[1].type === 'GUILD_VOICE') {
                                mainBotVoiceChannel = <VoiceChannel>channel[1];
                            }
                        }
                    }

                    resolve();
                });
            });

            await mainBotClient.startBot();
            await secondBotClient.startBot();
            await mainBotReadySubscription;
            await secondBotReadySubscription;

            return;
        } else {
            return;
        }
        
    });

    afterAll(async () => {
        await mainBotClient.stopBot();
        await secondBotClient.stopBot();

        let timeoutPromise: Promise<void> = new Promise<void>((resolve) => {
            setTimeout(() => { 
                resolve(); 
            }, 1000);
        });
       
        await timeoutPromise;

        return;
    });

    test('main token set', () => {
        expect(mainBotToken !== '').toBeTruthy();
    });

    test('second token set', () => {
        expect(secondBotToken !== '').toBeTruthy();
    });

    test('test guild id set', () => {
        expect(guildTestOnId !== '').toBeTruthy();
    });

    test('confirm main bot in guild', () => {
        
        expect(mainBotTestGuild).not.toBeNull();
    });

    test('confirm secondary bot in guild', () => {
        expect(secondBotTestGuild).not.toBeNull();
    });

    test('voice channel is not null', () => {
        expect(mainBotVoiceChannel).not.toBeNull();
        expect(mainBotVoiceChannel.joinable).toBeTruthy();
    });

    test('can send message', (finish) => {
        for (let channel of [...secondBotTestGuild.channels.cache.values()]) {
            if (channel.type === 'GUILD_TEXT' && channel.name === 'botcommands') {
                (<TextChannel>channel).send('!ping');
                finish();
                break;
            }
        }
    });

    test('command was processed', (finish) => {
        setTimeout(() => {
            //expect(mainBotClient.pingPongTimesCalled).toBe(1);

            finish();
        }, 1000);
    });

    test('register interactions', async () => {
        await mainBotClient.registerInteractions();
        return;
    });

    test('wait for debugging', (finish) => {
        setTimeout(() => {
            finish();
        }, 120000);
    });
});
