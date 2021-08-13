import { GuildMember, Message, Permissions, BitFieldResolvable, PermissionString } from 'discord.js';
import { ICommandPermissions, CommandPermissionType, CommandPermissionResult, 
        CommandPermissionResultStatus, 
        CommandPermissionRequirement} from '../../models/CommandPermission';
import { DiscordHelper } from '../helpers/discord.helper';
import { isNumber } from 'util';

export class CommandPermissionsService {
    public hasPermissions(command: ICommandPermissions, msg: Message): Promise<CommandPermissionResult> {
        return new Promise<CommandPermissionResult>((resolve : (val: CommandPermissionResult) => void) => {
            let returnResult: CommandPermissionResult = new CommandPermissionResult();
            returnResult.permissionStatus = CommandPermissionResultStatus.hasPermission;

            let guildMember: GuildMember = msg.member;
            let overallPermissionsPromise: Promise<CommandPermissionResultStatus> = Promise.resolve<CommandPermissionResultStatus>(CommandPermissionResultStatus.hasPermission);

            if (command.permissionRequirements.allRequirements.length > 0) {
                overallPermissionsPromise = overallPermissionsPromise.then((currentStatus: CommandPermissionResultStatus) => {
                    if (currentStatus === CommandPermissionResultStatus.noPermission) {
                        return Promise.resolve<CommandPermissionResultStatus>(currentStatus);
                    } else {
                        return this.testAllPermissions(msg, guildMember, command, returnResult.failedCommandRequirements);
                    }
                });
            }

            if (command.permissionRequirements.anyRequirements.length > 0) {
                overallPermissionsPromise = overallPermissionsPromise.then((currentStatus: CommandPermissionResultStatus) => {
                    if (currentStatus === CommandPermissionResultStatus.noPermission) {
                        return Promise.resolve<CommandPermissionResultStatus>(currentStatus);
                    } else {
                        return this.testAnyPermissions(msg, guildMember, command, returnResult.failedCommandRequirements);
                    }
                });
            }

            if (command.permissionRequirements.anyRequirementsByType.length > 0) {
                overallPermissionsPromise = overallPermissionsPromise.then((currentStatus: CommandPermissionResultStatus) => {
                    if (currentStatus === CommandPermissionResultStatus.noPermission) {
                        return Promise.resolve<CommandPermissionResultStatus>(currentStatus);
                    } else {
                        return this.testAnyByTypePermissions(msg, guildMember, command, returnResult.failedCommandRequirements);
                    }
                });
            }

            overallPermissionsPromise.then((finalStatus: CommandPermissionResultStatus) => {
                returnResult.permissionStatus = finalStatus;
                resolve(returnResult);
            });
        });
    }

    private testAllPermissions(msg: Message, guildMember: GuildMember, command: ICommandPermissions, failedRequirementsArr: CommandPermissionRequirement[]): Promise<CommandPermissionResultStatus> {
        return new Promise<CommandPermissionResultStatus>((resolve : (val: CommandPermissionResultStatus) => void) => {
            let p : Promise<CommandPermissionResultStatus> = Promise.resolve<CommandPermissionResultStatus>(CommandPermissionResultStatus.hasPermission);
            for (let i = 0; i < command.permissionRequirements.allRequirements.length; i++) {
                let requirement = command.permissionRequirements.allRequirements[i];
                p = p.then((returnStatus: CommandPermissionResultStatus) => new Promise<CommandPermissionResultStatus>((resolve : (val: CommandPermissionResultStatus) => void) => {
                    if (returnStatus === CommandPermissionResultStatus.noPermission) {
                        resolve(returnStatus);
                        return;
                    }

                    this.testPermission(msg, guildMember, requirement).then((hasPermission: boolean) => {
                        if (!hasPermission) {
                            returnStatus = CommandPermissionResultStatus.noPermission;
                        }

                        if (returnStatus === CommandPermissionResultStatus.noPermission) {
                            failedRequirementsArr.push(requirement);
                        }

                        resolve(returnStatus);
                    });
                }));
            }

            p.then((status: CommandPermissionResultStatus) => {
                resolve(status);
            });
        });
    }

    private testAnyPermissions(msg: Message, guildMember: GuildMember, command: ICommandPermissions, failedRequirementsArr: CommandPermissionRequirement[]): Promise<CommandPermissionResultStatus> {
        return new Promise<CommandPermissionResultStatus>((resolve : (val: CommandPermissionResultStatus) => void) => {
            let p : Promise<CommandPermissionResultStatus> = Promise.resolve<CommandPermissionResultStatus>(CommandPermissionResultStatus.noPermission);
            for (let i = 0; i < command.permissionRequirements.anyRequirements.length; i++) {
                let requirement = command.permissionRequirements.anyRequirements[i];
                p = p.then((returnStatus: CommandPermissionResultStatus) => new Promise<CommandPermissionResultStatus>((resolve : (val: CommandPermissionResultStatus) => void) => {
                    if (returnStatus === CommandPermissionResultStatus.hasPermission) {
                        resolve(returnStatus);
                        return;
                    }

                    this.testPermission(msg, guildMember, requirement).then((hasPermission: boolean) => {
                        if (hasPermission) {
                            returnStatus = CommandPermissionResultStatus.hasPermission;
                        }

                        if (returnStatus === CommandPermissionResultStatus.noPermission) {
                            failedRequirementsArr.push(requirement);
                        }

                        resolve(returnStatus);
                    });
                }));
            }

            p.then((status: CommandPermissionResultStatus) => {
                resolve(status);
            });
        });
    }

    private testAnyByTypePermissions(msg: Message, guildMember: GuildMember, command: ICommandPermissions, failedRequirementsArr: CommandPermissionRequirement[]): Promise<CommandPermissionResultStatus> {
        return new Promise<CommandPermissionResultStatus>((resolve : (val: CommandPermissionResultStatus) => void) => {
            let anyRequirementTypes: CommandPermissionType[] = this.getPermissionTypes(command.permissionRequirements.anyRequirementsByType);

            let requirementTypePromise: Promise<CommandPermissionResultStatus> = Promise.resolve<CommandPermissionResultStatus>(CommandPermissionResultStatus.hasPermission);
            for (let requirementType of anyRequirementTypes) {
                requirementTypePromise = requirementTypePromise.then((reqTypeStatus: CommandPermissionResultStatus) => new Promise<CommandPermissionResultStatus>((resolve : (val: CommandPermissionResultStatus) => void) => {
                    if (reqTypeStatus === CommandPermissionResultStatus.noPermission) {
                        resolve(reqTypeStatus);
                        return;
                    }
                    
                    let requirementPromise : Promise<CommandPermissionResultStatus> = Promise.resolve<CommandPermissionResultStatus>(CommandPermissionResultStatus.noPermission);
                    for (let i = 0; i < command.permissionRequirements.anyRequirementsByType.length; i++) {
                        let requirement = command.permissionRequirements.anyRequirementsByType[i];
                        if (requirement.permissionType === requirementType) {
                            requirementPromise = requirementPromise.then((returnStatus: CommandPermissionResultStatus) => new Promise<CommandPermissionResultStatus>((resolve : (val: CommandPermissionResultStatus) => void) => {
                                if (returnStatus === CommandPermissionResultStatus.hasPermission) {
                                    resolve(returnStatus);
                                    return;
                                }
            
                                this.testPermission(msg, guildMember, requirement).then((hasPermission: boolean) => {
                                    if (hasPermission) {
                                        returnStatus = CommandPermissionResultStatus.hasPermission;
                                    }
            
                                    if (returnStatus === CommandPermissionResultStatus.noPermission) {
                                        failedRequirementsArr.push(requirement);
                                    }
            
                                    resolve(returnStatus);
                                });
                            }));
                        }
                    }
        
                    requirementPromise.then((status: CommandPermissionResultStatus) => {
                        resolve(status);
                    });
                }));
            }

            requirementTypePromise.then((finalStatus: CommandPermissionResultStatus) => {
                resolve(finalStatus);
            });
        });
    }

    private testPermission(msg: Message, guildMember: GuildMember, requirement: CommandPermissionRequirement): Promise<boolean> {
        return new Promise<boolean>((resolve : (val: boolean) => void) => {
            switch (requirement.permissionType) {
                case CommandPermissionType.guild:
                    if (this.isGuild(guildMember, requirement.identifier)) {
                        resolve(true);
                        return;
                    }
                    break;
                case CommandPermissionType.role:
                    if (this.userIsInRole(guildMember, requirement.identifier)) {
                        resolve(true);
                        return;
                    }
                    break;
                case CommandPermissionType.user:
                    if (this.userIsCertainUser(guildMember, requirement.identifier)) {
                        resolve(true);
                        return;
                    }
                    break;
                case CommandPermissionType.textchannel:
                    if (this.msgIsInTextChannelById(msg, requirement.identifier)) {
                        resolve(true);
                        return;
                    }
                    break;
                case CommandPermissionType.anytextchannel:
                    if (this.msgIsInTextChannel(msg)) {
                        resolve(true);
                        return;
                    }
                    break;
                case CommandPermissionType.permission:
                    if (this.userHasPermissions(guildMember, requirement.identifier)) {
                        resolve(true);
                        return;
                    }
                    break;
                case CommandPermissionType.custom:
                    if (requirement.customCallback !== undefined && requirement.customCallback !== null) {
                        requirement.customCallback(msg, guildMember, requirement).then((hasPermission: boolean) => {
                            resolve(hasPermission);
                            return;
                        });
                        return;
                    }
                    break;
                default:
                    resolve(true);
                    return;
            }
    
            resolve(false);
            return;
        });
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

    private isNumeric(num){
        return !isNaN(num)
      }
}
