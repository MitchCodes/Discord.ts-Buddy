import { GuildMember, Message, Permissions, BitFieldResolvable, PermissionString, Interaction } from 'discord.js';
import { CommandInputContext } from '../../models/Command';
import { ICommandPermissions, CommandPermissionType, CommandPermissionResult, 
        CommandPermissionResultStatus, 
        CommandPermissionRequirement,
        CommandPermissionGrantRevokeType} from '../../models/CommandPermission';
import { DiscordHelper } from '../helpers/discord.helper';

export class CommandPermissionsService {
    public async hasPermissions(command: ICommandPermissions, inputContext: CommandInputContext, msg: Message, interaction: Interaction): Promise<CommandPermissionResult> {
        let returnResult: CommandPermissionResult = new CommandPermissionResult();

        if (command.permissionRequirements) {
            returnResult.permissionStatus = command.permissionRequirements.hasPermissionByDefault ? CommandPermissionResultStatus.hasPermission : CommandPermissionResultStatus.noPermission;

            if (command.permissionRequirements.requirements && command.permissionRequirements.requirements.length > 0) {
                let sortedRequirements: CommandPermissionRequirement[] = this.sortRequirementsByPriority(command.permissionRequirements.requirements);

                for (let requirement of sortedRequirements) {
                    let meetsRequirement: boolean = await this.testRequirement(inputContext, msg, interaction, requirement);

                    if (meetsRequirement) {
                        if (requirement.successGrantRevokeType === CommandPermissionGrantRevokeType.grant) {
                            returnResult.permissionStatus = CommandPermissionResultStatus.hasPermission;
                        } else if (requirement.successGrantRevokeType === CommandPermissionGrantRevokeType.revoke) {
                            returnResult.permissionStatus = CommandPermissionResultStatus.noPermission;
                        }
                    } else {
                        if (requirement.failGrantRevokeType === CommandPermissionGrantRevokeType.grant) {
                            returnResult.permissionStatus = CommandPermissionResultStatus.hasPermission;
                        } else if (requirement.failGrantRevokeType === CommandPermissionGrantRevokeType.revoke) {
                            returnResult.permissionStatus = CommandPermissionResultStatus.noPermission;
                        }
                    }
                }
            }
        }

        return returnResult;
    }

    public userHasPermissions(guildMember: GuildMember, permissionIdentifier: string): boolean {
        let permissionInput: string | number | Array<string> = permissionIdentifier;
        let permissionSplit: string[] = permissionIdentifier.split(',');
        if (permissionSplit.length > 1) {
            let permissionsArray: Array<string> = [];
            for (let permission of permissionSplit) {
                permissionsArray.push(permission);
            }
            permissionInput = permissionsArray;
        } else if (this.isNumeric(permissionIdentifier)) {
            permissionInput = Number(permissionIdentifier);
        }

        let permissions: Permissions = new Permissions((<BitFieldResolvable<PermissionString, bigint>>permissionInput));
        
        return guildMember.permissions.has(permissions);
    }

    private sortRequirementsByPriority(requirements: CommandPermissionRequirement[]): CommandPermissionRequirement[] {
        if (requirements) {
            return requirements.sort((a, b) => {
                if (a.priority && !b.priority) {
                    return -1;
                }

                if (!a.priority && b.priority) {
                    return 1;
                }

                if (!a.priority && !b.priority) {
                    return 0;
                }

                return a.priority - b.priority;
            });
        }

        return [];
    }

    private async testRequirement(inputContext: CommandInputContext, msg: Message, interaction: Interaction, requirement: CommandPermissionRequirement): Promise<boolean> {
        let guildMember: GuildMember = this.getGuildMember(inputContext, msg, interaction);
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
            case CommandPermissionType.permission:
                if (this.userHasPermissions(guildMember, requirement.identifier)) {
                    return true;
                }
                break;
            case CommandPermissionType.custom:
                if (requirement.customCallback !== undefined && requirement.customCallback !== null) {
                    let hasPermission: boolean = await requirement.customCallback(inputContext, msg, interaction, guildMember, requirement);
                    return hasPermission;
                }
                break;
            default:
                return true;
        }

        return false;
    }

    private getGuildMember(inputContext: CommandInputContext, msg: Message, interaction: Interaction): GuildMember {
        if (inputContext === CommandInputContext.interaction) {
            if (interaction && interaction instanceof GuildMember) {
                return <GuildMember>interaction.member;
            } else {
                return null;
            }
        } else if (inputContext === CommandInputContext.message) {
            if (msg) {
                return msg.member;
            } else {
                return null;
            }
        }

        return null;
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

    private isNumeric(num){
        return !isNaN(num)
    }
}
