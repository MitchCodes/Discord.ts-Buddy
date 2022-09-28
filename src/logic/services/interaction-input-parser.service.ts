import { ApplicationCommandOptionType, CommandInteraction, CommandInteractionOption } from "discord.js";
import { CommandUserInput } from "../../models/Command";
import { InputParseResult } from "../../models/CommandInputParse";

export class InteractionInputParserService {
    public async parseInteractionInput(userInput: CommandUserInput): Promise<InputParseResult> {
        let result: InputParseResult = new InputParseResult();

        let interaction: CommandInteraction = null;
        if (userInput.interaction && userInput.interaction.isCommand()) {
            interaction = userInput.interaction;
        }

        if (interaction) {
            result.commandTree = [];
            result.commandTree.push(interaction.commandName);

            let options: readonly CommandInteractionOption[] = interaction.options.data;
            if (options && options.length > 0) {
                this.parseInteractionInputOptions(result, options, userInput, interaction);
            }
        }

        return result;
    }

    private parseInteractionInputOptions(result: InputParseResult, options: CommandInteractionOption[] | readonly CommandInteractionOption[], userInput: CommandUserInput, interaction: CommandInteraction): void {
        let subCommand: CommandInteractionOption = null;
        for (let option of options) {
            if (option.type === ApplicationCommandOptionType.Subcommand || option.type === ApplicationCommandOptionType.SubcommandGroup) {
                subCommand = option;
                break;
            }
        }

        if (subCommand) {
            result.commandTree.push(subCommand.name);
            if (subCommand.options && subCommand.options.length > 0) {
                this.parseInteractionInputOptions(result, subCommand.options, userInput, interaction);
            }
        } else {
            for (let option of options) {
                if (option.type !== ApplicationCommandOptionType.Subcommand && option.type !== ApplicationCommandOptionType.SubcommandGroup) {
                    result.values[option.name] = option.value;
                }
            }
        }
    }

    public getIdFromMention(mention: string): string {
        let returnString: string = mention;

        if (returnString.startsWith('<@!') && returnString.endsWith('>')) {
            returnString = returnString.substring(3);
            returnString = returnString.substring(0, returnString.length - 1);
        }

        if (returnString.startsWith('<#') && returnString.endsWith('>')) {
            returnString = returnString.substring(2);
            returnString = returnString.substring(0, returnString.length - 1);
        }

        if (returnString.startsWith('<@&') && returnString.endsWith('>')) {
            returnString = returnString.substring(3);
            returnString = returnString.substring(0, returnString.length - 1);
        }

        return returnString;
    }

    public getListFromStringArray(arr: string[]): string {
        let message: string = '';

        for (let str of arr) {
            message += '* ' + str + '   ';
        }

        return message;
    }
}