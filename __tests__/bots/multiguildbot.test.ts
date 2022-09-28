/* eslint-disable @typescript-eslint/no-unused-vars */
import { Logger, createLogger, transports } from 'winston';
import * as nconf from 'nconf';
import { Guild, VoiceChannel, TextChannel, ChannelType } from 'discord.js';
import { MultiGuildBot } from '../../src/logic/bots/multi-guild-bot';
import { TestBot } from './testbot';
import { WinstonLogger } from 'tsdatautils-core';
import { PromiseHelper } from '../../src/main';

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
            await mainBotClient.setupBot();
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
                            if (channel[1].name === voiceChannelName && channel[1].type === ChannelType.GuildVoice) {
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
            if (channel.type === ChannelType.GuildText && channel.name === 'botcommands') {
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

    test('promise stuff', (finish) => {
        let testPromise: Promise<void> = new Promise<void>((resolve, reject) => {
            let timeout: NodeJS.Timeout = setTimeout(() => {
                reject('timeout');
            }, 500);

            let resolveTimeout: NodeJS.Timeout = setTimeout(() => {
                clearTimeout(timeout);
                resolve();
            }, 1000);
        });

        testPromise.then(() => {
            console.log('promise stuff Resolved');
        }).catch((err) => {
            console.log('promise stuff err: ' + err);
            finish();
        });
    });

    test('promise stuff two', async () => {
        let testPromise: Promise<void> = new Promise<void>((resolve, reject) => {
            let timeout: NodeJS.Timeout = setTimeout(() => {
                reject('timeout');
            }, 500);

            let resolveTimeout: NodeJS.Timeout = setTimeout(() => {
                clearTimeout(timeout);
                resolve();
            }, 1000);
        });

        try {
            await testPromise;
            console.log('promise stuff 2 resolve');
        } catch (err) {
            console.log('promise stuff 2 err: ' + err);
        }
        return;
    });

    test('promise stuff three', async () => {
        let testPromise: Promise<void> = new Promise<void>((resolve, reject) => {
            let timeout: NodeJS.Timeout = setTimeout(() => {
                reject('timeout');
            }, 1000);

            let resolveTimeout: NodeJS.Timeout = setTimeout(() => {
                resolve();
            }, 500);
        });

        let testPromiseTwo: Promise<void> = new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve();
            }, 2000);
        });

        try {
            await testPromise;
            console.log('promise stuff 3 resolve');
            await testPromiseTwo;
            console.log('promise stuff 3 yahoo')
        } catch (err) {
            console.log('promise stuff 3 err: ' + err);
        }
        return;
    });

    test('async error handling', async () => {
        let asyncHelper: AsyncHelper = new AsyncHelper();
        await asyncHelper.testFunction();
        return;
    });

    /* uncomment to give time to debug
    test('wait for debugging', (finish) => {
        setTimeout(() => {
            finish();
        }, 120000);
    });
    */
});


class AsyncHelper {
    public async testFunction(): Promise<void> {
        try {
            await this.testFunctionTwo();
            console.log('test function finished');
        } catch (err) {
            console.log('error caught: ' + err);
        }
    }
    
    public async testFunctionTwo(): Promise<void> {
        await this.testFunctionThree();
    }

    public async testFunctionThree(): Promise<void> {
        await this.failFunction();
    }

    public async failFunction(): Promise<void> {
        await PromiseHelper.sleep(1000);
        throw 'Fail!';
    }
}