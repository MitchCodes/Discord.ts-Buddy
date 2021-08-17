/* eslint-disable @typescript-eslint/ban-types */
import { ICommandFactory } from "../../models/Command";
import { ICommandPermissions } from "../../models/CommandPermission";

export class BotHelper {
    public hasCommandFactory(command: Object): command is ICommandFactory {
        return 'makeCommand' in command;
    }

    public hasCommandPermissions(command: Object): command is ICommandPermissions {
        return 'permissionRequirements' in command || 'permissionFailReplyType' in command;
    }
}