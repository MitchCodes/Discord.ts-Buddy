import { TextChannel, User } from 'discord.js';
import { StringHelper } from '../helpers/string.helper';
import { IDiscordBot } from '../../models/DiscordBot';

export class MessengerService {
    private maxTextMessageLength: number = 1900;

    public sendTextChannelMessage(bot: IDiscordBot, channel: TextChannel, message: string): Promise<string> {
        return new Promise<string>((resolve : (val: string) => void, reject : (val: string) => void) => {
            let stringHelper: StringHelper = new StringHelper();
            let textToSend: string[] = stringHelper.splitStringIfLengthExceeds(message, this.maxTextMessageLength);

            for (let curTextToSend of textToSend) {
                channel.send({
                    embeds: [
                        {
                            color: bot.color,
                            description: curTextToSend,
                        }
                    ],
                }).then((res: any) => {
                    resolve('Success');
                }).catch((reason: any) => {
                    if (bot.logger !== null && bot.logger !== undefined) {
                        bot.logger.error('Bot \'' + bot.name + '\' failed to send a text channel message. Error: ' + JSON.stringify(reason));
                    }
                    reject(reason);
                });
            }
        });
    }

    public sendDirectChannelMessage(bot: IDiscordBot, user: User, message: string): Promise<string> {
        return new Promise<string>((resolve : (val: string) => void, reject : (val: string) => void) => {
            let stringHelper: StringHelper = new StringHelper();
            let textToSend: string[] = stringHelper.splitStringIfLengthExceeds(message, this.maxTextMessageLength);

            for (let curTextToSend of textToSend) {
                user.send({
                    embeds: [
                        {
                            color: bot.color,
                            description: curTextToSend,
                        }
                    ],
                }).then((res: any) => {
                    resolve('Success');
                }).catch((reason: any) => {
                    if (bot.logger !== null && bot.logger !== undefined) {
                        bot.logger.error('Bot \'' + bot.name + '\' failed to send message to user ' + user.username + '. Error: ' + JSON.stringify(reason));
                    }
                    reject(reason);
                });
            }
        });
        
    }
}
