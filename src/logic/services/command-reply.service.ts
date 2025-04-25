/* eslint-disable @typescript-eslint/no-explicit-any */
import { CacheType, Interaction, InteractionEditReplyOptions, InteractionReplyOptions } from "discord.js";
import { CommandUserInput, CommandInputContext } from "../../models/Command";
import { CommandReplyOptions, CommandReplyStateOptions } from "../../models/CommandReply";
import { StringHelper } from "../helpers/string.helper";

export class CommandReplyService {
    private maxTextMessageLength: number;

    public constructor(maxTextMessageLength: number = 1900) {
        this.maxTextMessageLength = maxTextMessageLength;
    }

    public async reply(input: Interaction<CacheType>, options: CommandReplyOptions & CommandReplyStateOptions): Promise<void> {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.replyHybrid(commandInput, options);
    }

    public async replyHybrid(input: CommandUserInput, options: CommandReplyOptions & CommandReplyStateOptions): Promise<void> {
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
                if (input.interaction && input.interaction.isRepliable()) {    
                    if (options.wasDeferred && isFirst) {
                        let replyOptions: InteractionEditReplyOptions = {
                            content: content,
                            embeds: options.embeds,
                            files: options.files,
                            allowedMentions: options.mentions,
                            components: options.interactionComponents,
                        };
                        await input.interaction.editReply(replyOptions);
                    } else if (options.isFollowUp || !isFirst) {
                        let replyOptions: InteractionReplyOptions = {
                            content: content,
                            embeds: options.embeds,
                            files: options.files,
                            allowedMentions: options.mentions,
                            components: options.interactionComponents,
                            ephemeral: options.ephemeral
                        };
                        await input.interaction.followUp(replyOptions);
                    } else {
                        let replyOptions: InteractionReplyOptions = {
                            content: content,
                            embeds: options.embeds,
                            files: options.files,
                            allowedMentions: options.mentions,
                            components: options.interactionComponents,
                            ephemeral: options.ephemeral
                        };
                        await input.interaction.reply(replyOptions);
                    }
                } else {
                    throw 'Interaction is not repliable';
                }
            }

            isFirst = false;
        }
    }

    public async deferReply(input: Interaction<CacheType>, ephemeral: boolean = false): Promise<void> {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.deferReplyHybrid(commandInput, ephemeral);
    }

    public async deferReplyHybrid(input: CommandUserInput, ephemeral: boolean = false): Promise<void> {
        if (input.inputContext === CommandInputContext.interaction && input.interaction) {
            if (input.interaction.isRepliable()) {
                await input.interaction.deferReply({ephemeral: ephemeral});
            } else {
                throw 'Interaction does not have a deferReply function';
            }
        }
    }

    public async replyAfterDefer(input: Interaction<CacheType>, options: CommandReplyOptions & CommandReplyStateOptions): Promise<void> {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.replyAfterDeferHybrid(commandInput, options);
    }

    public async replyAfterDeferHybrid(input: CommandUserInput, options: CommandReplyOptions & CommandReplyStateOptions): Promise<void> {
        let copiedOptions: CommandReplyOptions & CommandReplyStateOptions = {...options};
        copiedOptions.wasDeferred = true;
        
        return await this.replyHybrid(input, copiedOptions);
    }

    public async followUp(input: Interaction<CacheType>, options: CommandReplyOptions & CommandReplyStateOptions): Promise<void> {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.followUpHybrid(commandInput, options);
    }

    public async followUpHybrid(input: CommandUserInput, options: CommandReplyOptions & CommandReplyStateOptions): Promise<void> {
        let copiedOptions: CommandReplyOptions & CommandReplyStateOptions = {...options};
        copiedOptions.isFollowUp = true;
        
        return await this.replyHybrid(input, copiedOptions);
    }
}