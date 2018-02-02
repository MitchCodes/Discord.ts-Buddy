import { GuildMember, Message } from 'discord.js';
import { ICommandPermissions, CommandPermissionType } from '../../models/CommandPermission';
import { DiscordHelper } from '../helpers/discord.helper';

export class CommandPermissionsService {
    // tslint:disable-next-line:cyclomatic-complexity
    public hasPermissions(command: ICommandPermissions, msg: Message): boolean {
        let guildMember: GuildMember = msg.member;
        for (let requirement of command.permissionRequirements.allRequirements) {
            switch (requirement.permissionType) {
                case CommandPermissionType.guild:
                    if (!this.isGuild(guildMember, requirement.identifier)) {
                        return false;
                    }
                    break;
                case CommandPermissionType.role:
                    if (!this.userIsInRole(guildMember, requirement.identifier)) {
                        return false;
                    }
                    break;
                case CommandPermissionType.user:
                    if (!this.userIsCertainUser(guildMember, requirement.identifier)) {
                        return false;
                    }
                    break;
                case CommandPermissionType.textchannel:
                    if (this.msgIsInTextChannelById(msg, requirement.identifier)) {
                        return false;
                    }
                    break;
                case CommandPermissionType.anytextchannel:
                    if (this.msgIsInTextChannel(msg)) {
                        return false;
                    }
                    break;
                default:
            }
        }

        let anyRequirementMet: boolean = false;
        for (let requirement of command.permissionRequirements.anyRequirements) {
            switch (requirement.permissionType) {
                case CommandPermissionType.guild:
                    if (this.isGuild(guildMember, requirement.identifier)) {
                        anyRequirementMet = true;
                    }
                    break;
                case CommandPermissionType.role:
                    if (this.userIsInRole(guildMember, requirement.identifier)) {
                        anyRequirementMet = true;
                    }
                    break;
                case CommandPermissionType.user:
                    if (this.userIsCertainUser(guildMember, requirement.identifier)) {
                        anyRequirementMet = true;
                    }
                    break;
                case CommandPermissionType.textchannel:
                    if (this.msgIsInTextChannelById(msg, requirement.identifier)) {
                        anyRequirementMet = true;
                    }
                    break;
                case CommandPermissionType.anytextchannel:
                    if (this.msgIsInTextChannel(msg)) {
                        return false;
                    }
                    break;
                default:
            }

            if (anyRequirementMet) {
                break;
            }
        }

        if (command.permissionRequirements.anyRequirements.length > 0 && !anyRequirementMet) {
            return false;
        }

        return true;
    }

    private isGuild(guildMember: GuildMember, guildIdentifier: string): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        return helper.doesGuildMatchId(guildMember.guild, guildIdentifier);
    }

    private userIsInRole(guildMember: GuildMember, roleIdentifier: string): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        return helper.rolesCollectionHasRole(guildMember.guild.roles.array(), roleIdentifier);
    }

    private userIsCertainUser(guildMember: GuildMember, userIdentifier: string): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        return helper.doesGuildMemberMatchId(guildMember, userIdentifier);
    }

    private msgIsInTextChannelById(msg: Message, channelIdentifier: string): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        return helper.msgIsInTextChannelById(msg, channelIdentifier);
    }

    private msgIsInTextChannel(msg: Message): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        return helper.msgIsInTextChannel(msg);
    }
}
