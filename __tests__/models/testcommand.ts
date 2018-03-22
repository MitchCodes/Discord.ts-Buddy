import { ICommand, ICommandFactory, ICommandResult, CommandResult, CommandResultStatus } from '../../src/models/Command';
import { Message, TextChannel } from 'discord.js';
import { ICommandPermissions, CommandPermissionRequirementSettings, CommandPermissionFeedbackType, 
    CommandPermissionType, CommandPermissionRequirement } from '../../src/models/CommandPermission';
import { IDiscordBot } from '../../src/models/DiscordBot';

export class TestCommand implements ICommand, ICommandFactory, ICommandPermissions {
    public commandName: string = 'Ping Pong';
    public commandDescription: string = 'Simple ping pong test';
    public commandMatchText: string = 'ping';
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType;
    public testIsSet: boolean = false;
    private args: string[] = null;

    public constructor(args: string[] = []) {
        this.args = args;
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
        return new TestCommand(args);
    }
    
    public execute(bot: IDiscordBot, msg: Message): Promise<ICommandResult> {
        return new Promise<ICommandResult>((resolve : (val: ICommandResult) => void) => {
            let result: CommandResult = new CommandResult();

            if (this.args.length > 1 && this.args[1] === 'pong') {
                this.testIsSet = true;
            }

            result.status = CommandResultStatus.success;
            resolve(result);
        });
    }
}
