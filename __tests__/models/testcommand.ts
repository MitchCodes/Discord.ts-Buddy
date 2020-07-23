import { ICommand, ICommandFactory, ICommandResult, CommandResult, CommandResultStatus } from '../../src/models/Command';
import { Message, TextChannel } from 'discord.js';
import { ICommandPermissions, CommandPermissionRequirementSettings, CommandPermissionFeedbackType, 
    CommandPermissionType, CommandPermissionRequirement } from '../../src/models/CommandPermission';
import { IDiscordBot } from '../../src/models/DiscordBot';
import { DH_NOT_SUITABLE_GENERATOR } from 'constants';
import { TestBot } from '../bots/testbot';

export class TestCommand implements ICommand, ICommandFactory, ICommandPermissions {
    public commandName: string = 'Ping Pong';
    public commandDescription: string = 'Simple ping pong test';
    public commandMatchText: string = 'ping';
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType;
    public testIsSet: boolean = false;

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

    public makeCommand(): ICommand {
        return new TestCommand();
    }
    
    public execute(bot: IDiscordBot, msg: Message): Promise<ICommandResult> {
        return new Promise<ICommandResult>((resolve : (val: ICommandResult) => void) => {
            let result: CommandResult = new CommandResult();

            if (msg.content === '!ping') {
                this.testIsSet = true;
                msg.channel.send('pong');
            }

            let botCasted: TestBot = <TestBot>bot;
            botCasted.pingPongTimesCalled += 1;

            result.status = CommandResultStatus.success;
            resolve(result);
        });
    }

    public setupPermissions(bot: IDiscordBot, msg: Message) {

    }
}
