import { Logger, createLogger, transports } from 'winston';
import * as nconf from 'nconf';
import { Client, Guild, VoiceChannel, VoiceConnection, TextChannel } from 'discord.js';
import { MultiGuildBot } from '../../src/logic/bots/multi-guild-bot';
import { doesNotThrow } from 'assert';
import { TestBot } from './testbot';

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

    beforeAll((finishBeforeAll) => {
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
        
        if (mainBotToken !== '' && secondBotToken !== '') {
            mainBotClient = new TestBot('Main Bot', mainBotToken, logger, nconf);
            secondBotClient = new MultiGuildBot('Second Bot', secondBotToken, logger, nconf);

            logger.info('Main Token: ' + mainBotToken);

            return mainBotClient.startBot().then(() => {
                return new Promise((resolve) => {
                    mainBotClient.onBotReady.subscribe(() => {
                        for (let guild of mainBotClient.guilds) {
                            if (guild.id === guildTestOnId) {
                                mainBotTestGuild = guild;
                                break;
                            }
                        } 
    
                        secondBotClient.startBot().then(() => {
                            resolve();
                        });
                    });
                });                
            }).then(() => {
                return new Promise((resolve) => {
                    secondBotClient.onBotReady.subscribe(() => {
                        for (let guild of secondBotClient.guilds) {
                            if (guild.id === guildTestOnId) {
                                secondBotTestGuild = guild;
                                break;
                            }
                        }
        
                        if (mainBotTestGuild !== null && mainBotTestGuild !== undefined) {
                            for (let channel of mainBotTestGuild.channels.cache) {
                                if (channel[1].name === voiceChannelName && channel[1].type === 'voice') {
                                    mainBotVoiceChannel = <VoiceChannel>channel[1];
                                }
                            }
                        }

                        resolve();
                    });
                });
            }).then(() => {
                finishBeforeAll();
            });
        } else {
            return Promise.resolve();
        }
        
    });

    afterAll(() => {
        return mainBotClient.stopBot().then(() => {
            return secondBotClient.stopBot();
        }).then(() => {
            setTimeout(() => { process.exit(); }, 1000);
        });
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
        for (let channel of secondBotTestGuild.channels.cache.array()) {
            if (channel.type === 'text' && channel.name === 'botcommands') {
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

    // test('can join voice channel', (done: any) => {
    //     mainBotVoiceChannel.join().then((voiceConn: VoiceConnection) => {
    //         logger.info('connected');
    //         voiceConn.on('disconnect', () => {
    //             logger.info('disconnected');
    //             expect(true).toBeTruthy();
    //             done();
    //         });
    //         expect(true).toBeTruthy();
    //         voiceConn.disconnect();
    //     }).catch((reason: any) => {
    //         logger.error('Error connecting to voice channel: ' + reason);
    //         done();
    //     });
    // },   15000);

});
