/* eslint-disable @typescript-eslint/no-empty-function */
import { ICommand, ICommandResult, CommandResult, CommandResultStatus, CommandInputContext, CommandInputSettings, ICommandFactory, CommandMatchingSettings, CommandMatchingType, CommandUserInput, CommandInteractionSettings, CommandInteraction, CommandInteractionRegistrationContext, CommandInteractionMainType, CommandInteractionContextTypeSettings } from '../../src/models/Command';
import { Message, Interaction } from 'discord.js';
import { ICommandPermissions, CommandPermissionRequirementSettings, CommandPermissionFeedbackType, 
    CommandPermissionType, CommandPermissionRequirement, CommandPermissionGrantRevokeType } from '../../src/models/CommandPermission';
import { IDiscordBot } from '../../src/models/DiscordBot';
import { CommandInputBuilder, CommandInputStructureOptionType, CommandReplyService, CommandUserInputParserService, InputParseResult } from '../../src/main';

export class PointsCommand implements ICommand, ICommandFactory, ICommandPermissions {
    public commandName: string = 'Points';
    public commandDescription: string = 'Test echo';
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType;
    public testIsSet: boolean = false;
    public inputSettings: CommandInputSettings;
    private commandInputBuilder: CommandInputBuilder;

    public constructor() {
        this.commandInputBuilder = new CommandInputBuilder().setName('points')
                                    .setDescription(this.commandDescription)
                                    .setMessageInputPrefix('!')
                                    .addSubCommandGroup(subGroup => {
                                        subGroup.setName('spend')
                                            .setDescription('Spend some points')
                                            .addSubCommand(sub => {
                                                sub.setName('cars')
                                                    .setDescription('Buy some cars')
                                                    .addOption(option => {
                                                        option.setName('cartype')
                                                            .setDescription('the type of car')
                                                            .setType(CommandInputStructureOptionType.string)
                                                            .setChoices([['honda', 'Honda'], ['toyota', 'Toyota']])
                                                            .setRequired(true)
                                                    })
                                                    .addOption(option => {
                                                        option.setName('amount')
                                                            .setDescription('the number of cars')
                                                            .setType(CommandInputStructureOptionType.number)
                                                    })
                                                    .addOption(option => {
                                                        option.setName('role')
                                                            .setDescription('The role to pick')
                                                            .setType(CommandInputStructureOptionType.role)
                                                    })
                                            })
                                            .addSubCommand(sub => {
                                                sub.setName('bitcoin')
                                                    .setDescription('Buy some bitcoin')
                                                    .addOption(option => {
                                                        option.setName('amount')
                                                        .setDescription('the number of cars')
                                                        .setType(CommandInputStructureOptionType.number)
                                                    })
                                            })
                                    });
    }

    public makeCommand(): ICommand {
        return new PointsCommand();
    }
    
    public async setupInputSettings(bot: IDiscordBot): Promise<void> {
        try {
            let commandInteractionSettings: CommandInteractionSettings = new CommandInteractionSettings();
            commandInteractionSettings.interactions = [];

            let commandMessageSettings: CommandMatchingSettings = this.commandInputBuilder.getMessageMatchingSettings();
            
            let mainSlashCommandBuilder = this.commandInputBuilder.toSlashCommandBuilder();

            let mainInteraction: CommandInteraction = new CommandInteraction(CommandInteractionRegistrationContext.allGuilds, mainSlashCommandBuilder);
            commandInteractionSettings.interactions.push(mainInteraction);

            this.inputSettings = new CommandInputSettings(commandMessageSettings, commandInteractionSettings);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async setupPermissions(bot: IDiscordBot, input: CommandUserInput): Promise<void> {
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
        return 'You do not have permission to do points.';
    }
    
    public async execute(bot: IDiscordBot, input: CommandUserInput): Promise<ICommandResult> {
            let result: CommandResult = new CommandResult(CommandResultStatus.success);
            let replyService: CommandReplyService = new CommandReplyService();
            let commandParserService: CommandUserInputParserService = new CommandUserInputParserService();

            await replyService.deferReply(input);

            let inputParseResult: InputParseResult = await commandParserService.parseUserInput(input, this.commandInputBuilder.input);
            if (!commandParserService.isValid(inputParseResult)) {
                let message: string = commandParserService.getDefaultValidationMessage(inputParseResult);
                await replyService.reply(input, { content: message });
                return result;
            }

            await replyService.replyAfterDefer(input, { content: 'boop', ephemeral: true });

            await replyService.followUp(input, { content: 'Private follow-up!', ephemeral: true });

            

            return result;
    }
}
