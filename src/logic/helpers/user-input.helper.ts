import { Guild, GuildMember, StageChannel, TextBasedChannel, VoiceChannel } from "discord.js";
import { CommandInputContext, CommandUserInput } from "../../models/Command";

export class UserInputHelper {
    public getGuildMember(input: CommandUserInput): GuildMember {
        if (input.inputContext === CommandInputContext.message) {
            return input.msg?.member;
        } else if (input.inputContext === CommandInputContext.interaction) {
            let member: GuildMember = <GuildMember>input.interaction?.member;
            if (member) {
                return member;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    public getChannel(input: CommandUserInput): TextBasedChannel {
        if (input.inputContext === CommandInputContext.message) {
            return input.msg?.channel;
        } else if (input.inputContext === CommandInputContext.interaction) {
            return input.interaction?.channel;
        } else {
            return null;
        }
    }

    public getCurrentVoiceChannel(input: CommandUserInput): (VoiceChannel | StageChannel) {
        if (input.inputContext === CommandInputContext.message) {
            return input.msg?.member?.voice?.channel;
        } else if (input.inputContext === CommandInputContext.interaction) {
            let member: GuildMember = <GuildMember>input.interaction?.member;
            if (member) {
                return member.voice?.channel;
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    public getGuild(input: CommandUserInput): Guild {
        if (input.inputContext === CommandInputContext.message) {
            return input.msg?.guild;
        } else if (input.inputContext === CommandInputContext.interaction) {
            return input.interaction?.guild;
        } else {
            return null;
        }
    }
}