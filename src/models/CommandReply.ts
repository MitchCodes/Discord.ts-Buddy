import { BaseMessageComponentOptions, BufferResolvable, FileOptions, MessageActionRow, MessageActionRowOptions, MessageAttachment, MessageEmbed, MessageMentionOptions } from "discord.js";

export class CommandReplyOptions {
    public embeds?: MessageEmbed[] = [];
    public content?: string = '';
    public files?: FileOptions[] | BufferResolvable[] | MessageAttachment[];
    public interactionComponents?: (MessageActionRow | (Required<BaseMessageComponentOptions> & MessageActionRowOptions))[];
    public mentions?: MessageMentionOptions;
    public ephemeral?: boolean = false;

}

export class CommandReplyStateOptions {
    public wasDeferred?: boolean = false;
    public isFollowUp?: boolean = false;
}