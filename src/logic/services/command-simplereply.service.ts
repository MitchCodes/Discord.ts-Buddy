/* eslint-disable @typescript-eslint/no-unused-vars */
import { CommandUserInput } from "../../models/Command";
import { CommandReplyOptions } from "../../models/CommandReply";
import { CommandReplyService } from "./command-reply.service";

export class CommandSimpleReplyService {
    private commandReplyService: CommandReplyService;
    private isDeferred: boolean = false;
    private isReplied: boolean = false;

    public constructor(maxTextMessageLength: number = 1900) {
        this.commandReplyService = new CommandReplyService(maxTextMessageLength);
    }

    public async deferReply(input: CommandUserInput, ephemeral: boolean = false): Promise<void> {
        await this.commandReplyService.deferReply(input, ephemeral);
        this.isDeferred = true;
    }

    public async reply(input: CommandUserInput, options: CommandReplyOptions): Promise<void> {
        if (!this.isReplied) {
            if (this.isDeferred) {
                await this.commandReplyService.replyAfterDefer(input, {...options, wasDeferred: true, isFollowUp: false});
            } else {
                await this.commandReplyService.reply(input, {...options, wasDeferred: false, isFollowUp: false});
            }

            this.isReplied = true;
        } else {
            await this.commandReplyService.followUp(input, {...options, wasDeferred: false, isFollowUp: true});
        }
    }
}