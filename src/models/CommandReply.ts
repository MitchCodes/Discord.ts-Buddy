import { APIActionRowComponent, APIAttachment, APIEmbed, APIMessageActionRowComponent, Attachment, AttachmentBuilder, AttachmentPayload, BufferResolvable, JSONEncodable, MessageActionRowComponentBuilder, MessageActionRowComponentData, MessageMentionOptions } from "discord.js";
import { Stream } from "stream";

export class CommandReplyOptions {
    public embeds?: APIEmbed[] = [];
    public content?: string = '';
    public files?: (BufferResolvable | Stream | JSONEncodable<APIAttachment> | Attachment | AttachmentBuilder | AttachmentPayload)[];
    public interactionComponents?: (    
        | JSONEncodable<APIActionRowComponent<APIMessageActionRowComponent>>
        | APIActionRowComponent<APIMessageActionRowComponent>
        )[];
    public mentions?: MessageMentionOptions;
    public ephemeral?: boolean = false;

}

export class CommandReplyStateOptions {
    public wasDeferred?: boolean = false;
    public isFollowUp?: boolean = false;
}