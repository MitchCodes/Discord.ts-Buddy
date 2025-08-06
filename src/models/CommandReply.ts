import { APIAttachment, APIEmbed, APIMessageTopLevelComponent, TopLevelComponentData, ActionRowData, Attachment, AttachmentBuilder, AttachmentPayload, BufferResolvable, JSONEncodable, MessageMentionOptions, MessageActionRowComponentData, MessageActionRowComponentBuilder } from "discord.js";
import { Stream } from "stream";

export class CommandReplyOptions {
    public embeds?: APIEmbed[] = [];
    public content?: string = '';
    public files?: (BufferResolvable | Stream | JSONEncodable<APIAttachment> | Attachment | AttachmentBuilder | AttachmentPayload)[];
    public interactionComponents?: readonly ( | JSONEncodable<APIMessageTopLevelComponent> | TopLevelComponentData | ActionRowData<MessageActionRowComponentData | MessageActionRowComponentBuilder> | APIMessageTopLevelComponent )[]
    public mentions?: MessageMentionOptions;
    public ephemeral?: boolean = false;

}

export class CommandReplyStateOptions {
    public wasDeferred?: boolean = false;
    public isFollowUp?: boolean = false;
}