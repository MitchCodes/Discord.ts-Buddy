import { CacheType, Guild, GuildMember, Interaction, StageChannel, TextBasedChannel, VoiceBasedChannel, VoiceChannel } from "discord.js";
import { CommandInputContext, CommandUserInput } from "../../models/Command";

export class UserInputHelper {
    public getGuildMember(input: Interaction<CacheType>): GuildMember {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.getGuildMemberHybrid(commandInput);
    }

    public getGuildMemberHybrid(input: CommandUserInput): GuildMember {
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

    public getChannel(input: Interaction<CacheType>): TextBasedChannel {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.getChannelHybrid(commandInput);
    }

    public getChannelHybrid(input: CommandUserInput): TextBasedChannel {
        if (input.inputContext === CommandInputContext.message) {
            return input.msg?.channel;
        } else if (input.inputContext === CommandInputContext.interaction) {
            return input.interaction?.channel;
        } else {
            return null;
        }
    }

    public getCurrentVoiceChannel(input: Interaction<CacheType>): VoiceBasedChannel {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.getCurrentVoiceChannelHybrid(commandInput);
    }

    public getCurrentVoiceChannelHybrid(input: CommandUserInput): VoiceBasedChannel {
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

    public getGuild(input: Interaction<CacheType>): Guild {
        let commandInput: CommandUserInput = new CommandUserInput(CommandInputContext.interaction, null, input);
        return this.getGuildHybrid(commandInput);
    }

    public getGuildHybrid(input: CommandUserInput): Guild {
        if (input.inputContext === CommandInputContext.message) {
            return input.msg?.guild;
        } else if (input.inputContext === CommandInputContext.interaction) {
            return input.interaction?.guild;
        } else {
            return null;
        }
    }
}