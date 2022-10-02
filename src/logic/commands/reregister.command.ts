import { RESTPostAPIApplicationCommandsJSONBody, Interaction, CacheType, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { Provider } from "nconf";
import { ILogger } from "tsdatautils-core";
import { CommandResult, CommandResultStatus, ICommand, ICommandResult } from "../../models/Command";
import { InputParseResult } from "../../models/CommandInputParse";
import { IDiscordBot } from "../../models/DiscordBot";
import { MultiGuildBot } from "../bots/multi-guild-bot";
import { CommandReplyService } from "../services/command-reply.service";
import { InteractionCommand } from "./interaction.command";

export class ReregisterCommand extends InteractionCommand {

    public constructor(logger: ILogger, configProvider: Provider) {
        super('Reregister', 'Reregister interactions', logger, configProvider);
    }

    makeCommand(): ICommand {
        return new ReregisterCommand(this.logger, this.configProvider);
    }

    getCommandBuilder(): RESTPostAPIApplicationCommandsJSONBody {
        return new SlashCommandBuilder().setName('reregister')
            .setDescription('Reregister commands')
            .setDMPermission(false)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .toJSON();
    }

    async executeInteraction(bot: IDiscordBot, input: Interaction<CacheType>, inputParseResult: InputParseResult, replyService: CommandReplyService): Promise<ICommandResult> {
        let result: ICommandResult = new CommandResult(CommandResultStatus.success);

        let multiGuildBot: MultiGuildBot = <MultiGuildBot>bot;
        await multiGuildBot.registerInteractions(true);

        return result;
    }
}