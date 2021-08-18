/* eslint-disable @typescript-eslint/no-empty-function */
import { ICommand, ICommandResult, CommandResult, CommandResultStatus, CommandInputContext, CommandInputSettings, ICommandFactory, CommandMatchingSettings, CommandMatchingType, CommandUserInput, CommandInteractionSettings, CommandInteraction, CommandInteractionRegistrationContext, CommandInteractionMainType, CommandInteractionContextTypeSettings } from '../../src/models/Command';
import { Message, Interaction } from 'discord.js';
import { ICommandPermissions, CommandPermissionRequirementSettings, CommandPermissionFeedbackType, 
    CommandPermissionType, CommandPermissionRequirement, CommandPermissionGrantRevokeType } from '../../src/models/CommandPermission';
import { IDiscordBot } from '../../src/models/DiscordBot';
import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInputBuilder, CommandInputStructureOptionType, CommandReplyService } from '../../src/main';

export class EchoCommand implements ICommand, ICommandFactory, ICommandPermissions {
    public commandName: string = 'Echo';
    public commandDescription: string = 'Test echo';
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType;
    public testIsSet: boolean = false;
    public inputSettings: CommandInputSettings;
    private commandInputBuilder: CommandInputBuilder;

    public constructor() {
        this.commandInputBuilder = new CommandInputBuilder().setName('beep')
                                    .setDescription(this.commandDescription)
                                    .addOption(option => 
                                        option.setName('input')
                                            .setDescription('The input to echo back')
                                            .setType(CommandInputStructureOptionType.string)
                                            .setRequired(true)
                                    );
    }

    public makeCommand(): ICommand {
        return new EchoCommand();
    }
    
    public async setupInputSettings(bot: IDiscordBot): Promise<void> {
        let commandInteractionSettings: CommandInteractionSettings = new CommandInteractionSettings();
        commandInteractionSettings.interactions = [];

        let commandMessageSettings: CommandMatchingSettings = this.commandInputBuilder.getMessageMatchingSettings();
        let mainSlashCommandBuilder = this.commandInputBuilder.toSlashCommandBuilder();

        let mainInteraction: CommandInteraction = new CommandInteraction(CommandInteractionRegistrationContext.global, mainSlashCommandBuilder);
        commandInteractionSettings.interactions.push(mainInteraction);

        let userInteraction: CommandInteraction = new CommandInteraction(CommandInteractionRegistrationContext.global);
        userInteraction.mainType = CommandInteractionMainType.contextUser;
        userInteraction.contextMenuMainTypeSettings = new CommandInteractionContextTypeSettings();
        userInteraction.contextMenuMainTypeSettings.name = 'Echo Me Daddy';
        commandInteractionSettings.interactions.push(userInteraction);

        let messageInteraction: CommandInteraction = new CommandInteraction(CommandInteractionRegistrationContext.allGuilds);
        messageInteraction.mainType = CommandInteractionMainType.contextMessage;
        messageInteraction.contextMenuMainTypeSettings = new CommandInteractionContextTypeSettings();
        messageInteraction.contextMenuMainTypeSettings.name = 'Echo Message';
        messageInteraction.overridePermissions = new CommandPermissionRequirementSettings();
        messageInteraction.overridePermissions.hasPermissionByDefault = true;
        commandInteractionSettings.interactions.push(messageInteraction);

        this.inputSettings = new CommandInputSettings(commandMessageSettings, commandInteractionSettings);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public setupPermissions(bot: IDiscordBot, commandInputContext: CommandInputContext, msg: Message, interaction: Interaction): void {
        let anyTextChannelReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        anyTextChannelReq.permissionType = CommandPermissionType.anytextchannel;

        let textChannelReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        textChannelReq.permissionType = CommandPermissionType.textchannel;
        textChannelReq.identifier = 'botcommands';
        textChannelReq.successGrantRevokeType = CommandPermissionGrantRevokeType.grant;

        let permissionReq: CommandPermissionRequirement = new CommandPermissionRequirement();
        permissionReq.permissionType = CommandPermissionType.role;
        permissionReq.identifier = 'Admin';
        permissionReq.successGrantRevokeType = CommandPermissionGrantRevokeType.grant;

        this.permissionRequirements = new CommandPermissionRequirementSettings();
        this.permissionRequirements.hasPermissionByDefault = false;
        this.permissionRequirements.requirements.push(anyTextChannelReq);
        this.permissionRequirements.requirements.push(textChannelReq);
        this.permissionRequirements.requirements.push(permissionReq);


        this.permissionFailReplyType = CommandPermissionFeedbackType.direct;
    }

    public getPermissionFailReplyText(commandInputContext: CommandInputContext, msg: Message, interaction: Interaction): string {
        return 'You do not have permission to beep boop.';
    }
    
    public async execute(bot: IDiscordBot, input: CommandUserInput): Promise<ICommandResult> {
            let result: CommandResult = new CommandResult();
            let replyService: CommandReplyService = new CommandReplyService();
            await replyService.deferReply(input);

            await replyService.replyAfterDefer(input, { content: 'boop', ephemeral: true });

            await replyService.followUp(input, { content: 'Private follow-up!', ephemeral: true });

            result.status = CommandResultStatus.success;

            return result;
    }
}
