import { Interaction, RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import { Provider } from "nconf";
import { ILogger } from "tsdatautils-core";
import { CommandInputContext, CommandInputSettings, CommandInteraction, CommandInteractionRegistrationContext, CommandInteractionSettings, CommandMatchingSettings, CommandMatchingType, CommandResult, CommandResultStatus, CommandUserInput, ICommand, ICommandConfig, ICommandFactory, ICommandLogger, ICommandResult } from "../../models/Command";
import { IDiscordBot } from "../../models/DiscordBot";
import { CommandReplyService } from "../services/command-reply.service";

export abstract class InteractionCommand implements ICommand, ICommandFactory, ICommandConfig, ICommandLogger {
    public configProvider: Provider;
    public logger: ILogger;   
    public commandName: string;
    public commandDescription: string;
    public inputSettings: CommandInputSettings;
    protected interactionRegistrationContext: CommandInteractionRegistrationContext = CommandInteractionRegistrationContext.allGuilds;
    protected deferReply: boolean = true;
    protected warnOldCommand: boolean = false;
    protected oldCommandPrefix: string = '!';

    public constructor(commandName: string, commandDescription: string, logger: ILogger, configProvider: Provider) {
        this.commandName = commandName;
        this.commandDescription = commandDescription;
        this.logger = logger;
        this.configProvider = configProvider;
    }

    abstract makeCommand(): ICommand;
    abstract getCommandBuilder(): RESTPostAPIApplicationCommandsJSONBody;
    abstract executeInteraction(bot: IDiscordBot, input: Interaction, replyService: CommandReplyService): Promise<ICommandResult>;

    public async setupInputSettings(bot: IDiscordBot): Promise<void> {
        let commandInteractionSettings: CommandInteractionSettings = new CommandInteractionSettings();
        commandInteractionSettings.interactions = this.addInteractions(bot);

        // Only add message match settings when warning to not use the old style of commands
        let messageMatchSettings: CommandMatchingSettings = null;
        if (this.warnOldCommand) {
            let interactionName: string = null;
            if (commandInteractionSettings && commandInteractionSettings.interactions) {
                interactionName = commandInteractionSettings.interactions[0].applicationCommand.name;
            }
            messageMatchSettings = new CommandMatchingSettings(interactionName, CommandMatchingType.prefixedOneWord, this.oldCommandPrefix);
        }
        
        this.inputSettings = new CommandInputSettings(messageMatchSettings, commandInteractionSettings);
    }

    public addInteractions(bot: IDiscordBot): CommandInteraction[] {
        return [new CommandInteraction(this.interactionRegistrationContext, this.getCommandBuilder())];
    }

    public async execute(bot: IDiscordBot, input: CommandUserInput): Promise<ICommandResult> {
        let replyService: CommandReplyService = new CommandReplyService();

        if (this.warnOldCommand && input.inputContext === CommandInputContext.message && input.msg) {
            let message: string = 'Please use the slash Discord command style of command. Use /' + this.inputSettings.interactionSettings.interactions[0].applicationCommand.name + ' instead.';
            await replyService.replyHybrid(input, { content: message });
            return new CommandResult(CommandResultStatus.success);
        }

        if (input.inputContext !== CommandInputContext.interaction || !input.interaction) {
            return new CommandResult(CommandResultStatus.success);
        }

        if (this.deferReply) {
            await replyService.deferReplyHybrid(input);
        }

        return await this.executeInteraction(bot, input.interaction, replyService);
    }
}