import { Message } from 'discord.js';

export enum CommandPermissionType {
    user,
    role,
    guild,
    textchannel,
    anytextchannel,
}

export enum CommandPermissionFeedbackType {
    silent,
    direct,
    textchannel,
}

export class CommandPermissionRequirement {
    public permissionType: CommandPermissionType;
    public identifier: string;
    public deleteMessageIfFail: boolean;
}

export class CommandPermissionRequirementSettings {
    public allRequirements: CommandPermissionRequirement[] = [];
    public anyRequirements: CommandPermissionRequirement[] = [];
}

export interface ICommandPermissions {
    permissionRequirements: CommandPermissionRequirementSettings;
    permissionFailReplyType: CommandPermissionFeedbackType;
    getPermissionFailReplyText(msg: Message): string;
}

export enum CommandPermissionResultStatus {
    noPermission = 0,
    hasPermission = 1,
}

export class CommandPermissionResult {
    public permissionStatus: CommandPermissionResultStatus;
    public failedCommandRequirements: CommandPermissionRequirement[] = [];
}
