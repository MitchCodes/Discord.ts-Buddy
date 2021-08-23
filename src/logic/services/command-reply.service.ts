/* eslint-disable @typescript-eslint/no-explicit-any */
import { InteractionReplyOptions } from "discord.js";
import { CommandUserInput, CommandInputContext } from "../../models/Command";
import { CommandReplyOptions } from "../../models/CommandReply";
import { StringHelper } from "../helpers/string.helper";

export class CommandReplyService {
    private maxTextMessageLength: number;

    public constructor(maxTextMessageLength: number = 1900) {
        this.maxTextMessageLength = maxTextMessageLength;
    }

    public async reply(input: CommandUserInput, options: CommandReplyOptions): Promise<void> {
        if (!input) {
            return;
        }

        let stringHelper: StringHelper = new StringHelper();
        let contents: string[];
        if (options.content) {
            contents = stringHelper.splitStringIfLengthExceeds(options.content, this.maxTextMessageLength);
        } else {
            contents = [''];
        }
        
        let isFirst: boolean = true;
        for (let content of contents) {
            if (input.inputContext === CommandInputContext.message) {
                if (input.msg) {
                    if (options.ephemeral) {
                        await input.msg.member.send({
                            content: content,
                            embeds: options.embeds,
                            files: options.files,
                            allowedMentions: options.mentions,
                            components: options.interactionComponents,
                        });
                    } else {
                        await input.msg.reply({ 
                            content: content,
                            embeds: options.embeds,
                            files: options.files,
                            allowedMentions: options.mentions,
                            components: options.interactionComponents,
                        });
                    }
                }
            } 
            
            if (input.inputContext === CommandInputContext.interaction) {
                if (input.interaction) {
                    let interactionAny: any = <any>input.interaction;
    
                    if (options.wasDeferred && isFirst) {
                        if (interactionAny.editReply) {
                            let replyOptions: InteractionReplyOptions = {
                                content: content,
                                embeds: options.embeds,
                                files: options.files,
                                allowedMentions: options.mentions,
                                components: options.interactionComponents,
                            };
                            await interactionAny.editReply(replyOptions);
                        } else {
                            throw 'Interaction does not have a editReply function';
                        }
                    } else if (options.isFollowUp || !isFirst) {
                        if (interactionAny.followUp) {
                            let replyOptions: InteractionReplyOptions = {
                                content: content,
                                embeds: options.embeds,
                                files: options.files,
                                allowedMentions: options.mentions,
                                components: options.interactionComponents,
                                ephemeral: options.ephemeral
                            };
                            await interactionAny.followUp(replyOptions);
                        } else {
                            throw 'Interaction does not have a followUp function';
                        }
                    } else {
                        if (interactionAny.reply) {
                            let replyOptions: InteractionReplyOptions = {
                                content: content,
                                embeds: options.embeds,
                                files: options.files,
                                allowedMentions: options.mentions,
                                components: options.interactionComponents,
                                ephemeral: options.ephemeral
                            };
                            await interactionAny.reply(replyOptions);
                        } else {
                            throw 'Interaction does not have a reply function';
                        }
                    }
                }
            }

            isFirst = false;
        }
    }

    public async deferReply(input: CommandUserInput, ephemeral: boolean = false): Promise<void> {
        if (input.inputContext === CommandInputContext.interaction) {
            let interactionAny: any = <any>input.interaction;
            if (interactionAny.deferReply) {
                await interactionAny.deferReply({ ephemeral: ephemeral });
            } else {
                throw 'Interaction does not have a deferReply function';
            }
        }
    }

    public async replyAfterDefer(input: CommandUserInput, options: CommandReplyOptions): Promise<void> {
        let copiedOptions: CommandReplyOptions = {...options};
        copiedOptions.wasDeferred = true;
        
        return await this.reply(input, copiedOptions);
    }

    public async followUp(input: CommandUserInput, options: CommandReplyOptions): Promise<void> {
        let copiedOptions: CommandReplyOptions = {...options};
        copiedOptions.isFollowUp = true;
        
        return await this.reply(input, copiedOptions);
    }
}