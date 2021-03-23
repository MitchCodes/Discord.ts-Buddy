import { GuildMember, Guild, Role, Message, TextChannel } from 'discord.js';

export class DiscordHelper {
    public getMemberByNickUsernameOrId(guild: Guild, identifier: string): GuildMember {
        let resultingMember: GuildMember = null;
        let guildMemberArray: GuildMember[] = guild.members.cache.array();
        let nameLowered = identifier.toLowerCase();
        for (let currentGuildMember of guildMemberArray) {
            let currentGuildMemberUsername = currentGuildMember.user.username;
            let currentGuildMemberNick = currentGuildMember.nickname;
            let currentGuildMemberId = currentGuildMember.user.id;
            let currentGuildMemberDisplayName = currentGuildMember.displayName;
            let currentGuildMemberGuildId = currentGuildMember.id;
            if (currentGuildMemberUsername !== null && currentGuildMemberUsername !== undefined 
                && currentGuildMemberUsername.toLowerCase() === nameLowered) {
                resultingMember = currentGuildMember;
                break;
            } else if (currentGuildMemberNick !== null && currentGuildMemberNick !== undefined 
                && currentGuildMemberNick.toLowerCase() === nameLowered) {
                resultingMember = currentGuildMember;
                break;
            } else if (currentGuildMemberId !== null && currentGuildMemberId !== undefined 
                && currentGuildMemberId.toLowerCase() === nameLowered) {
                resultingMember = currentGuildMember;
                break;
            } else if (currentGuildMemberDisplayName !== null && currentGuildMemberDisplayName !== undefined 
                && currentGuildMemberDisplayName.toLowerCase() === nameLowered) {
                resultingMember = currentGuildMember;
                break;
            } else if (currentGuildMemberGuildId !== null && currentGuildMemberGuildId !== undefined 
                && currentGuildMemberGuildId.toLowerCase() === nameLowered) {
                resultingMember = currentGuildMember;
                break;
            }
        }

        return resultingMember;
    }

    public doesGuildMatchId(guild: Guild, identifier: string): boolean {
        let identifierLowered: string = identifier.toLowerCase();

        if (guild.name.toLowerCase() === identifierLowered) {
            return true;
        }

        if (guild.id === identifier) {
            return true;
        }

        return false;
    }

    public rolesCollectionHasRole(roles: Role[], identifier: string): boolean {
        let identifierLowered: string = identifier.toLowerCase();
        for (let role of roles) {
            if (role.name.toLowerCase() === identifierLowered) {
                return true;
            }
            if (role.id === identifier) {
                return true;
            }
        }

        return false;
    }

    public doesGuildMemberMatchId(guildMember: GuildMember, identifier: string): boolean {
        let identifierLowered: string = identifier.toLowerCase();

        if (guildMember.user.username.toLowerCase() === identifierLowered) {
            return true;
        }

        if (guildMember.user.id === identifier) {
            return true;
        }

        return false;
    }

    public msgIsInTextChannel(msg: Message): boolean {
        if (msg.channel.type === "text") {
            return true;
        }

        return false;
    }

    public msgIsInTextChannelById(msg: Message, identifier: string): boolean {
        let identifierLowered: string = identifier.toLowerCase();
        if (msg.channel.type === "text") {
            let textChannel: TextChannel = <TextChannel>msg.channel;
            if (textChannel.name.toLowerCase() === identifierLowered) {
                return true;
            }
            if (textChannel.id === identifier) {
                return true;
            }
        }

        return false;
    }
}
