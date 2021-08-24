import { Message, GuildMember, Interaction } from 'discord.js';
import { IDiscordBot } from '../main';
import { CommandInputContext, CommandUserInput } from './Command';

export enum CommandPermissionType {
    user,
    role,
    guild,
    textchannel,
    anytextchannel,
    custom,
    permission,
}

export enum CommandPermissionFeedbackType {
    silent,
    direct,
    textchannel,
}

export enum CommandPermissionGrantRevokeType {
    grant = 0,
    revoke = 1,
    none = 2,
}

export class CommandPermissionRequirement {
    public permissionType: CommandPermissionType;
    public identifier: string;
    public deleteMessageIfFail: boolean;
    /** What to do when the requirement is met */
    public successGrantRevokeType: CommandPermissionGrantRevokeType = CommandPermissionGrantRevokeType.none;
    /** What to do when the requirement is not met */
    public failGrantRevokeType: CommandPermissionGrantRevokeType = CommandPermissionGrantRevokeType.none;
    /** The higher the priority, the more it takes precedence over other requirements that include or exclude. */
    public priority: number = 1;
    public customCallback: (commandInputContext: CommandInputContext, msg: Message, interaction: Interaction, guildMember: GuildMember, requirement: CommandPermissionRequirement) => Promise<boolean>;

    public constructor(permissionType: CommandPermissionType = CommandPermissionType.user, identifier: string = '', successGrantRevokeType: CommandPermissionGrantRevokeType = CommandPermissionGrantRevokeType.grant) {
        this.permissionType = permissionType;
        this.identifier = identifier;
        this.successGrantRevokeType = successGrantRevokeType;
    }
}

export class CommandPermissionRequirementSettings {
    public requirements: CommandPermissionRequirement[] = [];
    public hasPermissionByDefault: boolean = false;

    public constructor(requirements: CommandPermissionRequirement[] = [], hasPermissionByDefault: boolean = false) {
        this.requirements = requirements;
        this.hasPermissionByDefault = hasPermissionByDefault;
    }
}

export interface ICommandPermissions {
    permissionRequirements: CommandPermissionRequirementSettings;
    permissionFailReplyType: CommandPermissionFeedbackType;
    getPermissionFailReplyText(commandInputContext: CommandInputContext, msg: Message, interaction: Interaction): string;
    setupPermissions(bot: IDiscordBot, input: CommandUserInput): void;
}

export enum CommandPermissionResultStatus {
    noPermission = 0,
    hasPermission = 1,
}

export class CommandPermissionResult {
    public permissionStatus: CommandPermissionResultStatus;
    public failedCommandRequirements: CommandPermissionRequirement[] = [];
}
