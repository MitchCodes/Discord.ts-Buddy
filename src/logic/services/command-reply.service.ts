/* eslint-disable @typescript-eslint/no-explicit-any */
import { InteractionReplyOptions } from "discord.js";
import { CommandUserInput, CommandInputContext } from "../../models/Command";
import { CommandReplyOptions } from "../../models/CommandReply";

export class CommandReplyService {
    public async reply(input: CommandUserInput, options: CommandReplyOptions): Promise<void> {
        if (!input) {
            return;
        }

        if (input.inputContext === CommandInputContext.message) {
            if (input.msg) {
                if (options.ephemeral) {
                    await input.msg.member.send({
                        content: options.content,
                        embeds: options.embeds,
                        files: options.files,
                        allowedMentions: options.mentions,
                        components: options.interactionComponents,
                    });
                } else {
                    await input.msg.reply({ 
                        content: options.content,
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

                if (options.wasDeferred) {
                    if (interactionAny.editReply) {
                        let replyOptions: InteractionReplyOptions = {
                            content: options.content,
                            embeds: options.embeds,
                            files: options.files,
                            allowedMentions: options.mentions,
                            components: options.interactionComponents,
                        };
                        await interactionAny.editReply(replyOptions);
                    } else {
                        throw 'Interaction does not have a editReply function';
                    }
                } else if (options.isFollowUp) {
                    if (interactionAny.followUp) {
                        let replyOptions: InteractionReplyOptions = {
                            content: options.content,
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
                            content: options.content,
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