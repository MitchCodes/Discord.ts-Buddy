/* eslint-disable @typescript-eslint/no-empty-function */
import { ICommand, ICommandResult, CommandResult, CommandResultStatus, CommandInputContext, CommandInputSettings, ICommandFactory, CommandMatchingSettings, CommandMatchingType, CommandUserInput } from '../../src/models/Command';
import { Message, GuildMember, Interaction } from 'discord.js';
import { ICommandPermissions, CommandPermissionRequirementSettings, CommandPermissionFeedbackType, 
    CommandPermissionType, CommandPermissionRequirement, CommandPermissionGrantRevokeType } from '../../src/models/CommandPermission';
import { IDiscordBot } from '../../src/models/DiscordBot';
import { TestBot } from '../bots/testbot';

export class TestCommand implements ICommand, ICommandFactory, ICommandPermissions {
    public commandName: string = 'Ping Pong';
    public commandDescription: string = 'Simple ping pong test';
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType;
    public testIsSet: boolean = false;
    public inputSettings: CommandInputSettings;

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

        this.permissionRequirements.requirements.push(anyBizarreReq);
        this.permissionRequirements.requirements.push(anyTextForAnyReq);

        this.permissionRequirements.requirements.push(customReq);
        //this.permissionRequirements.requirements.push(customFailReq);

        this.permissionFailReplyType = CommandPermissionFeedbackType.direct;

    }

    public makeCommand(): ICommand {
        return new TestCommand();
    }
    
    public async setupInputSettings(bot: IDiscordBot): Promise<void> {
        // set up parser matching settings
        let commandMessageSettings: CommandMatchingSettings = new CommandMatchingSettings('ping', CommandMatchingType.prefixedOneWord, '!', ' ');
        this.inputSettings = new CommandInputSettings(commandMessageSettings, null);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async setupPermissions(bot: IDiscordBot, input: CommandUserInput): Promise<void> {
        
    }

    public getPermissionFailReplyText(commandInputContext: CommandInputContext, msg: Message, interaction: Interaction): string {
        return 'You do not have permission to ping pong.';
    }
    
    public execute(bot: IDiscordBot, input: CommandUserInput): Promise<ICommandResult> {
        return new Promise<ICommandResult>((resolve : (val: ICommandResult) => void) => {
            let result: CommandResult = new CommandResult();

            if (input.msg.content === '!ping') {
                this.testIsSet = true;
                if (input.msg.channel && 'send' in input.msg.channel) {
                    input.msg.channel.send('pong');
                }
            }

            let botCasted: TestBot = <TestBot>bot;
            botCasted.pingPongTimesCalled += 1;

            result.status = CommandResultStatus.success;
            resolve(result);
        });
    }
}
