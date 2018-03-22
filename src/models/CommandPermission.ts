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
