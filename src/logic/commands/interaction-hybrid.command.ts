/* eslint-disable @typescript-eslint/no-unused-vars */
import { Message, Interaction } from "discord.js";
import { Provider } from "nconf";
import { ILogger } from "tsdatautils-core";
import { CommandInputContext, CommandInputSettings, CommandInteraction, CommandInteractionRegistrationContext, CommandInteractionSettings, CommandMatchingSettings, CommandResult, CommandResultStatus, CommandUserInput, ICommand, ICommandConfig, ICommandFactory, ICommandLogger, ICommandResult } from "../../models/Command";
import { InputParseResult } from "../../models/CommandInputParse";
import { CommandPermissionFeedbackType, CommandPermissionRequirement, CommandPermissionRequirementSettings, ICommandPermissions } from "../../models/CommandPermission";
import { IDiscordBot } from "../../models/DiscordBot";
import { CommandInputBuilder } from "../builders/command-input.builder";
import { CommandSimpleReplyService } from "../services/command-simplereply.service";
import { CommandUserInputParserService } from "../services/command-user-input-parser.service";

export abstract class InteractionHybridCommand implements ICommand, ICommandFactory, ICommandPermissions, ICommandConfig, ICommandLogger {
    public configProvider: Provider;
    public logger: ILogger;   
    public commandName: string;
    public commandDescription: string;
    public inputSettings: CommandInputSettings;
    public permissionRequirements: CommandPermissionRequirementSettings;
    public permissionFailReplyType: CommandPermissionFeedbackType = CommandPermissionFeedbackType.textchannel;
    protected setupMessageMatching: boolean = false;
    protected interactionRegistrationContext: CommandInteractionRegistrationContext = CommandInteractionRegistrationContext.allGuilds;
    protected commandInputBuilder: CommandInputBuilder = null;
    protected deferReply: boolean = true;

    public constructor(commandName: string, commandDescription: string, logger: ILogger, configProvider: Provider) {
        this.commandName = commandName;
        this.commandDescription = commandDescription;
        this.logger = logger;
        this.configProvider = configProvider;
        this.permissionRequirements = new CommandPermissionRequirementSettings();
        this.commandInputBuilder = this.setupInputBuilder();
    }

    abstract makeCommand(): ICommand;
    abstract setupInputBuilder(): CommandInputBuilder;
    abstract executeInteraction(bot: IDiscordBot, input: CommandUserInput, inputParseResult: InputParseResult, replyService: CommandSimpleReplyService): Promise<ICommandResult>;

    public async setupInputSettings(bot: IDiscordBot): Promise<void> {
        let commandInteractionSettings: CommandInteractionSettings = new CommandInteractionSettings();
        commandInteractionSettings.interactions = this.addInteractions(bot);
        
        let commandMatchingSettings: CommandMatchingSettings = null;
        if (this.setupMessageMatching && this.commandInputBuilder && this.commandInputBuilder.input.prefix) {
            commandMatchingSettings = this.commandInputBuilder.getMessageMatchingSettings();
        }
        this.inputSettings = new CommandInputSettings(commandMatchingSettings, commandInteractionSettings);
    }

    public addInteractions(bot: IDiscordBot): CommandInteraction[] {
        return [new CommandInteraction(this.interactionRegistrationContext, this.commandInputBuilder.toSlashCommandBuilder())];
    }

    public async setupPermissions(bot: IDiscordBot, input: CommandUserInput): Promise<void> {
        let isInitialSetup: boolean = (!input.msg && !input.interaction);

        for (let requirement of this.setupRolePermissions(bot, input, isInitialSetup)) {
            this.permissionRequirements.requirements.push(requirement);
        }

        for (let requirement of this.setupUserPermissions(bot, input, isInitialSetup)) {
            this.permissionRequirements.requirements.push(requirement);
        }

        if (!isInitialSetup) {
            for (let requirement of this.setupChannelPermissions(bot, input, isInitialSetup)) {
                this.permissionRequirements.requirements.push(requirement);
            }

            for (let requirement of this.setupOtherPermissions(bot, input, isInitialSetup)) {
                this.permissionRequirements.requirements.push(requirement);
            }
        }

        this.permissionRequirements.hasPermissionByDefault = this.calculateDefaultPermission(bot, input, isInitialSetup, this.permissionRequirements.requirements);
    }

    public setupRolePermissions(bot: IDiscordBot, input: CommandUserInput, isInitialSetup: boolean): CommandPermissionRequirement[] {
        return [];
    }

    public setupUserPermissions(bot: IDiscordBot, input: CommandUserInput, isInitialSetup: boolean): CommandPermissionRequirement[] {
        return [];
    }

    public setupChannelPermissions(bot: IDiscordBot, input: CommandUserInput, isInitialSetup: boolean): CommandPermissionRequirement[] {
        return [];
    }

    public setupOtherPermissions(bot: IDiscordBot, input: CommandUserInput, isInitialSetup: boolean): CommandPermissionRequirement[] {
        return [];
    }

    public calculateDefaultPermission(bot: IDiscordBot, input: CommandUserInput, isInitialSetup: boolean, requirements: CommandPermissionRequirement[]): boolean {
        if (isInitialSetup) {
            return true;
        } else {
            if (requirements && requirements.length > 0) {
                return true;
            }
            return false;
        }
    }

    public getPermissionFailReplyText(commandInputContext: CommandInputContext, msg: Message, interaction: Interaction): string {
        return 'You cannot run this command.';
    }

    public async execute(bot: IDiscordBot, input: CommandUserInput): Promise<ICommandResult> {
        let replyService: CommandSimpleReplyService = new CommandSimpleReplyService();
        let commandParserService: CommandUserInputParserService = new CommandUserInputParserService();

        if (this.deferReply) {
            await replyService.deferReply(input);
        }

        let inputParseResult: InputParseResult = await commandParserService.parseUserInput(input, this.commandInputBuilder.input);
        if (!commandParserService.isValid(inputParseResult)) {
            let message: string = commandParserService.getDefaultValidationMessage(inputParseResult);
            await replyService.reply(input, { content: message });
            return new CommandResult(CommandResultStatus.success);
        }

        return await this.executeInteraction(bot, input, inputParseResult, replyService);
    }
}