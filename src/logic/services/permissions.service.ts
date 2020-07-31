import { GuildMember, Message } from 'discord.js';
import { ICommandPermissions, CommandPermissionType, CommandPermissionResult, 
        CommandPermissionResultStatus, 
        CommandPermissionRequirement} from '../../models/CommandPermission';
import { DiscordHelper } from '../helpers/discord.helper';

export class CommandPermissionsService {
    // tslint:disable-next-line:cyclomatic-complexity
    public hasPermissions(command: ICommandPermissions, msg: Message): CommandPermissionResult {
        let returnResult: CommandPermissionResult = new CommandPermissionResult();
        returnResult.permissionStatus = CommandPermissionResultStatus.hasPermission;

        let guildMember: GuildMember = msg.member;
        for (let requirement of command.permissionRequirements.allRequirements) {
            if (!this.testPermission(msg, guildMember, requirement)) {
                returnResult.permissionStatus = CommandPermissionResultStatus.noPermission;
            }

            if (returnResult.permissionStatus === CommandPermissionResultStatus.noPermission) {
                returnResult.failedCommandRequirements.push(requirement);
                
                return returnResult;
            }
        }

        if (command.permissionRequirements.anyRequirements.length > 0) {
            returnResult.permissionStatus = CommandPermissionResultStatus.noPermission;
            let anyRequirementMet: boolean = false;
            for (let requirement of command.permissionRequirements.anyRequirements) {
                if (this.testPermission(msg, guildMember, requirement)) {
                    anyRequirementMet = true;
                } else {
                    returnResult.failedCommandRequirements.push(requirement);
                }

                if (anyRequirementMet) {
                    returnResult.permissionStatus = CommandPermissionResultStatus.hasPermission;
                }
            }
        }

        if (command.permissionRequirements.anyRequirementsByType.length > 0) {
            let anyRequirementTypes: CommandPermissionType[] = this.getPermissionTypes(command.permissionRequirements.anyRequirementsByType);
            returnResult.permissionStatus = CommandPermissionResultStatus.noPermission;
            let allAnyRequirementMet: boolean = true;

            for (let requirementType of anyRequirementTypes) {
                let anyRequirementMet: boolean = false;
                for (let requirement of command.permissionRequirements.anyRequirementsByType) {
                    if (requirement.permissionType === requirementType) {
                        if (this.testPermission(msg, guildMember, requirement)) {
                            anyRequirementMet = true;
                        } else {
                            returnResult.failedCommandRequirements.push(requirement);
                        }
                    }
                }

                if (!anyRequirementMet) {
                    allAnyRequirementMet = false;
                }
            }

            if (allAnyRequirementMet) {
                returnResult.permissionStatus = CommandPermissionResultStatus.hasPermission;
            }

            
        }
        
        return returnResult;
    }

    private testPermission(msg: Message, guildMember: GuildMember, requirement: CommandPermissionRequirement): boolean {
        switch (requirement.permissionType) {
            case CommandPermissionType.guild:
                if (this.isGuild(guildMember, requirement.identifier)) {
                    return true;
                }
                break;
            case CommandPermissionType.role:
                if (this.userIsInRole(guildMember, requirement.identifier)) {
                    return true;
                }
                break;
            case CommandPermissionType.user:
                if (this.userIsCertainUser(guildMember, requirement.identifier)) {
                    return true;
                }
                break;
            case CommandPermissionType.textchannel:
                if (this.msgIsInTextChannelById(msg, requirement.identifier)) {
                    return true;
                }
                break;
            case CommandPermissionType.anytextchannel:
                if (this.msgIsInTextChannel(msg)) {
                    return true;
                }
                break;
            default:
                return true;
        }

        return false;
    }

    private getPermissionTypes(permissionRequirements: CommandPermissionRequirement[]): CommandPermissionType[] {
        let returnPermissionTypes: CommandPermissionType[] = [];

        for (let permissionRequirement of permissionRequirements) {
            if (returnPermissionTypes.indexOf(permissionRequirement.permissionType) === -1) {
                returnPermissionTypes.push(permissionRequirement.permissionType);
            }
        }

        return returnPermissionTypes;
    }

    private isGuild(guildMember: GuildMember, guildIdentifier: string): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        return helper.doesGuildMatchId(guildMember.guild, guildIdentifier);
    }

    private userIsInRole(guildMember: GuildMember, roleIdentifier: string): boolean {
        let identifierLowered: string = roleIdentifier.toLowerCase();
        for (let role of guildMember.roles.cache) {
            if (role[1].name.toLowerCase() === identifierLowered) {
                return true;
            }
            if (role[1].id === roleIdentifier) {
                return true;
            }
        }

        return false;
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
