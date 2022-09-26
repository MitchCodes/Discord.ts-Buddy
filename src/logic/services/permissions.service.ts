import { GuildMember, Message, Interaction, ChannelType } from 'discord.js';
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
                if (this.msgIsInTextChannelById(inputContext, msg, interaction, requirement.identifier)) {
                    return true;
                }
                break;
            case CommandPermissionType.anytextchannel:
                if (this.msgIsInTextChannel(inputContext, msg, interaction)) {
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
            if (interaction && interaction.member instanceof GuildMember) {
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

    private msgIsInTextChannelById(inputContext: CommandInputContext, msg: Message, interaction: Interaction, channelIdentifier: string): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        if (inputContext === CommandInputContext.message) {
            return helper.msgIsInTextChannelById(msg, channelIdentifier);
        } else if (inputContext === CommandInputContext.interaction) {
            if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
                let identifierLowered: string = channelIdentifier.toLowerCase();
                
                if (interaction.channel.name.toLowerCase() === identifierLowered) {
                    return true;
                }
                
                if (interaction.channel.id === channelIdentifier) {
                    return true;
                }
            }
        }

        return false;
    }

    private msgIsInTextChannel(inputContext: CommandInputContext, msg: Message, interaction: Interaction): boolean {
        let helper: DiscordHelper = new DiscordHelper();

        if (inputContext === CommandInputContext.message) {
            return helper.msgIsInTextChannel(msg);
        } else if (inputContext === CommandInputContext.interaction) {
            if (interaction.channel && interaction.channel.type === ChannelType.GuildText) {
                return true;
            }
        }

        return false;
    }    

    private isNumeric(num){
        return !isNaN(num)
    }
}
