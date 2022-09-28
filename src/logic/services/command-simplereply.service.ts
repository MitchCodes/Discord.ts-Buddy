/* eslint-disable @typescript-eslint/no-unused-vars */
import { CacheType, Interaction } from "discord.js";
import { CommandInputContext, CommandUserInput } from "../../models/Command";
import { CommandReplyOptions, CommandReplyStateOptions } from "../../models/CommandReply";
import { CommandReplyService } from "./command-reply.service";

export class CommandSimpleReplyService {
    private commandReplyService: CommandReplyService;
    private isDeferred: boolean = false;
    private isReplied: boolean = false;

    public constructor(maxTextMessageLength: number = 1900) {
        this.commandReplyService = new CommandReplyService(maxTextMessageLength);
    }

    public async deferReply(input: Interaction<CacheType>, ephemeral: boolean = false): Promise<void> {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.deferReplyHybrid(commandInput, ephemeral);
    }

    public async deferReplyHybrid(input: CommandUserInput, ephemeral: boolean = false): Promise<void> {
        await this.commandReplyService.deferReplyHybrid(input, ephemeral);
        this.isDeferred = true;
    }

    public async reply(input: Interaction<CacheType>, options: CommandReplyOptions): Promise<void> {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.replyHybrid(commandInput, options);
    }

    public async replyHybrid(input: CommandUserInput, options: CommandReplyOptions): Promise<void> {
        if (!this.isReplied) {
            if (this.isDeferred) {
                await this.commandReplyService.replyAfterDeferHybrid(input, {...options, wasDeferred: true, isFollowUp: false});
            } else {
                await this.commandReplyService.replyHybrid(input, {...options, wasDeferred: false, isFollowUp: false});
            }

            this.isReplied = true;
        } else {
            await this.commandReplyService.followUpHybrid(input, {...options, wasDeferred: false, isFollowUp: true});
        }
    }
}