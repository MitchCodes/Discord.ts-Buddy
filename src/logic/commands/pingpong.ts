import { ICommand, ICommandFactory, ICommandResult, CommandResult, CommandResultStatus } from '../../models/Command';
import { ICommandPermissions, CommandPermissionRequirementSettings, CommandPermissionFeedbackType, 
        CommandPermissionType, CommandPermissionRequirement } from '../../models/CommandPermission';
import { Message, TextChannel } from 'discord.js';
import { MessengerService } from '../services/messenger.service';
import { IDiscordBot } from '../../models/DiscordBot';

export class PingPongCommand implements ICommand, ICommandFactory, ICommandPermissions {
    public commandName: string = 'Ping Pong';
    public commandDescription: string = 'Simple ping pong test';
    public commandMatchText: string = 'ping';
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType;

    public constructor() {
        let anyTextChannelReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        anyTextChannelReq.permissionType = CommandPermissionType.anytextchannel;

        this.permissionRequirements = new CommandPermissionRequirementSettings();
        this.permissionRequirements.allRequirements.push(anyTextChannelReq);
        this.permissionFailReplyType = CommandPermissionFeedbackType.direct;
    }

    public getPermissionFailReplyText(msg: Message): string {
        return 'You do not have permission to ping pong.';
    }

    public makeCommand(args: string[]): ICommand {
        return new PingPongCommand();
    }
    
    public execute(bot: IDiscordBot, msg: Message): Promise<ICommandResult> {
        return new Promise<ICommandResult>((resolve : (val: ICommandResult) => void) => {
            let result: CommandResult = new CommandResult();
            let messengerService: MessengerService = new MessengerService();
            
            messengerService.sendTextChannelMessage(bot, <TextChannel>msg.channel, 'Pong!');

            result.status = CommandResultStatus.success;
            resolve(result);
        });
    }
}
