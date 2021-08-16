import { ICommand, ICommandFactory, ICommandResult, CommandResult, CommandResultStatus, CommandInputContext } from '../../src/models/Command';
import { Message, GuildMember, Interaction } from 'discord.js';
import { ICommandPermissions, CommandPermissionRequirementSettings, CommandPermissionFeedbackType, 
    CommandPermissionType, CommandPermissionRequirement, CommandPermissionGrantRevokeType } from '../../src/models/CommandPermission';
import { IDiscordBot } from '../../src/models/DiscordBot';
import { TestBot } from '../bots/testbot';

export class TestCommandTwo implements ICommand, ICommandFactory, ICommandPermissions {
    public commandName: string = 'Ping Pong';
    public commandDescription: string = 'Simple ping pong test';
    public commandMatchText: string = 'ping';
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType;
    public testIsSet: boolean = false;

    public constructor() {
        let anyTextChannelReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        anyTextChannelReq.permissionType = CommandPermissionType.anytextchannel;

        let textChannelReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        textChannelReq.permissionType = CommandPermissionType.textchannel;
        textChannelReq.identifier = 'botcommands';
        textChannelReq.successGrantRevokeType = CommandPermissionGrantRevokeType.grant;

        let customReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        customReq.permissionType = CommandPermissionType.custom;
        customReq.customCallback = ((commandInputContext: CommandInputContext, msg: Message, interaction: Interaction, guildMember: GuildMember, requirement: CommandPermissionRequirement): Promise<boolean> => {
            return Promise.resolve<boolean>(true);
        });
        customReq.successGrantRevokeType = CommandPermissionGrantRevokeType.grant;

        let customFailReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        customFailReq.permissionType = CommandPermissionType.custom;
        customFailReq.customCallback = ((commandInputContext: CommandInputContext, msg: Message, interaction: Interaction, guildMember: GuildMember, requirement: CommandPermissionRequirement): Promise<boolean> => {
            return Promise.resolve<boolean>(false);
        });
        customFailReq.successGrantRevokeType = CommandPermissionGrantRevokeType.grant;

        let permissionReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        permissionReq.permissionType = CommandPermissionType.permission;
        permissionReq.identifier = 'ADMINISTRATOR';
        permissionReq.failGrantRevokeType = CommandPermissionGrantRevokeType.revoke;


        let anyBizarreReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        anyBizarreReq.permissionType = CommandPermissionType.textchannel;
        anyBizarreReq.identifier = 'kjahsdkjshdskjhd';
        anyBizarreReq.successGrantRevokeType = CommandPermissionGrantRevokeType.grant;

        let anyTextForAnyReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        anyTextForAnyReq.permissionType = CommandPermissionType.anytextchannel;
        anyTextForAnyReq.successGrantRevokeType = CommandPermissionGrantRevokeType.grant;



        this.permissionRequirements = new CommandPermissionRequirementSettings();
        this.permissionRequirements.requirements.push(anyTextChannelReq);
        this.permissionRequirements.requirements.push(textChannelReq);
        this.permissionRequirements.requirements.push(customReq);
        this.permissionRequirements.requirements.push(permissionReq);

        this.permissionRequirements.requirements.push(anyBizarreReq);
        this.permissionRequirements.requirements.push(anyTextForAnyReq);

        this.permissionRequirements.requirements.push(customReq);
        //this.permissionRequirements.requirements.push(customFailReq);

        this.permissionFailReplyType = CommandPermissionFeedbackType.direct;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public setupPermissions(bot: IDiscordBot, commandInputContext: CommandInputContext, msg: Message, interaction: Interaction): void {
        
    }

    public getPermissionFailReplyText(commandInputContext: CommandInputContext, msg: Message, interaction: Interaction): string {
        return 'You do not have permission to ping pong.';
    }

    public makeCommand(): ICommand {
        return new TestCommandTwo();
    }
    
    public execute(bot: IDiscordBot, msg: Message): Promise<ICommandResult> {
        return new Promise<ICommandResult>((resolve : (val: ICommandResult) => void) => {
            let result: CommandResult = new CommandResult();

            if (msg.content === '!ping') {
                this.testIsSet = true;
                msg.channel.send('pong2');
            }

            let botCasted: TestBot = <TestBot>bot;
            botCasted.pingPongTimesCalled += 1;

            result.status = CommandResultStatus.success;
            resolve(result);
        });
    }
}
