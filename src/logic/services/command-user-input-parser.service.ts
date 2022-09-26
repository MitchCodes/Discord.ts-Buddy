/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApplicationCommandOptionType, CommandInteraction, CommandInteractionOption, Guild } from "discord.js";
import { BasicDictionary } from "../../models/BasicDictionary";
import { CommandInputContext, CommandUserInput } from "../../models/Command";
import { InputParseResult, InputParseValidation, InputParseValidationType } from "../../models/CommandInputParse";
import { CommandInputStructure, CommandInputStructureOption, CommandInputStructureOptionType } from "../../models/CommandInputStructure";
import { StringHelper } from "../helpers/string.helper";

export class CommandUserInputParserService {
    public async parseUserInput(userInput: CommandUserInput, structure: CommandInputStructure): Promise<InputParseResult> {
        let parseResult: InputParseResult = null;

        let structureValidations: string[] = this.validateInputStructure(structure);
        if (structureValidations && structureValidations.length > 0) {
            throw this.getListFromStringArray(structureValidations);
        }

        let guild: Guild = null;
        if (userInput.inputContext === CommandInputContext.message) {
            parseResult = await this.parseMessageInput(userInput, structure);
            guild = userInput.msg.guild;
        } else if (userInput.inputContext === CommandInputContext.interaction) {
            parseResult = await this.parseInteractionInput(userInput, structure);
            guild = userInput.interaction.guild;
        }

        await this.validateUserInput(parseResult, userInput, structure, guild);

        return parseResult;
    }

    public isValid(parseResult: InputParseResult): boolean {
        let validationOptions: string[] = Object.keys(parseResult.validation);
        for (let validationOption of validationOptions) {
            let validations: InputParseValidation[] = parseResult.validation[validationOption];
            if (validations && validations.length > 0) {
                return false;
            }
        }

        return true;
    }

    public getDefaultValidationMessage(parseResult: InputParseResult, findFirst: boolean = false, initialMessage: string = 'Command not input correctly:\n'): string {
        let validationMessage: string = initialMessage;

        if (parseResult.validation) {
            let validationOptions: string[] = Object.keys(parseResult.validation);
            let foundFirst: boolean = false;
            for (let validationOption of validationOptions) {
                let validations: InputParseValidation[] = parseResult.validation[validationOption];
                if (validations && validations.length > 0) {
                    for (let validation of validations) {
                        if (foundFirst) {
                            validationMessage += "\n";
                        }
                        validationMessage += validation.message;

                        foundFirst = true;
                        break;
                    }
                }

                if (findFirst && foundFirst) {
                    break;
                }
            }
        }

        return validationMessage;
    }
    
    private validateInputStructure(structure: CommandInputStructure): string[] {
        let validationMessages: string[] = [];

        if (!structure.name) {
            validationMessages.push('No name specified.');
        }

        let hasSubCommand: boolean = false;
        for (let option of structure.options) {
            if (option.type === CommandInputStructureOptionType.subCommandGroup) {
                hasSubCommand = true;
                if (option.options) {
                    for (let subCommandGroupOption of option.options) {
                        if (subCommandGroupOption.type === CommandInputStructureOptionType.subCommand) {
                            if (subCommandGroupOption.options) {
                                this.validateInputStructureOption(subCommandGroupOption.options, validationMessages);
                            }
                        }
                    }
                }
            } else if (option.type === CommandInputStructureOptionType.subCommand) {
                hasSubCommand = true;
                if (option.options) {
                    this.validateInputStructureOption(option.options, validationMessages);
                }
            }
        }

        if (!hasSubCommand) {
            this.validateInputStructureOption(structure.options, validationMessages);
        }

        return validationMessages;
    }

    private validateInputStructureOption(options: CommandInputStructureOption[], validationMessages: string[]): void {
        // validate normal options (string, integer, etc)
        // handle message option optionals (not required)
        // if one is optional and then one is required, how to know which input is which
        // validate, if message, that there is no required options after an optional one. throw if it happens

        let hasOptionalOption: boolean = false;
        for (let option of options) {
            if (!option.required) {
                hasOptionalOption = true;
            }

            if (option.required && hasOptionalOption) {
                validationMessages.push('Required options can not come after optional options in the command structure');
                break;
            }
        }
    }

    private async parseMessageInput(userInput: CommandUserInput, structure: CommandInputStructure): Promise<InputParseResult> {
        let result: InputParseResult = new InputParseResult();

        if (userInput.msg) {
            let stringHelper: StringHelper = new StringHelper();
            let splitWithQuotes: string[] = stringHelper.splitSpacesWithQuotes(userInput.msg.content);
            
            if (splitWithQuotes.length > 0) {   
                if (splitWithQuotes[0] === structure.prefix + structure.name) {
                    // first part of the command matches up

                    result.commandTree = [];
                    result.commandTree.push(structure.name);


                    if (structure.options) {
                        this.parseMessageInputOptions(result, null, structure.options, userInput, structure, splitWithQuotes);
                        this.getOptionValuesFromTree(result, structure, splitWithQuotes);
                    }
                }
            }
        }

        return result;
    }

    private parseMessageInputOptions(result: InputParseResult, sourceOption: CommandInputStructureOption, options: CommandInputStructureOption[], userInput: CommandUserInput, structure: CommandInputStructure, contentSplit: string[]): void {
        let optionsInfo = this.getOptionsInfo(options);

        let subCommands: CommandInputStructureOption[] = null;
        if (optionsInfo.hasSubCommandGroup) {
            subCommands = optionsInfo.dictionaryByType[CommandInputStructureOptionType.subCommandGroup];
        } else if (optionsInfo.hasSubCommand) {
            subCommands = optionsInfo.dictionaryByType[CommandInputStructureOptionType.subCommand];
        }

        if (subCommands) {
            if (contentSplit.length > result.commandTree.length) {
                let userInputCommand: string = contentSplit[result.commandTree.length];

                let foundSubCommand: CommandInputStructureOption = null;
                for (let subCommmand of subCommands) {
                    if (subCommmand && subCommmand.name) {
                        if (subCommmand.name.toLowerCase() === userInputCommand.toLowerCase()) {
                            foundSubCommand = subCommmand;
                            break;
                        }
                    }
                }

                if (foundSubCommand) {
                    result.commandTree.push(userInputCommand);

                    if (foundSubCommand.options) {
                        this.parseMessageInputOptions(result, null, foundSubCommand.options, userInput, structure, contentSplit);
                    }
                }
            } else {
                return;
            }
        }
    }

    private async parseInteractionInput(userInput: CommandUserInput, structure: CommandInputStructure): Promise<InputParseResult> {
        let result: InputParseResult = new InputParseResult();

        let interaction: CommandInteraction = null;
        if (userInput.interaction && userInput.interaction.isCommand()) {
            interaction = <CommandInteraction>userInput.interaction;
        }

        if (interaction) {
            if (structure.name.toLowerCase() === interaction.commandName.toLowerCase()) {
                result.commandTree = [];
                result.commandTree.push(structure.name);

                let options: readonly CommandInteractionOption[] = interaction.options.data;
                if (options && options.length > 0) {
                    this.parseInteractionInputOptions(result, options, userInput, structure, interaction);
                }
            }
        }

        return result;
    }

    private parseInteractionInputOptions(result: InputParseResult, options: CommandInteractionOption[] | readonly CommandInteractionOption[], userInput: CommandUserInput, structure: CommandInputStructure, interaction: CommandInteraction): void {
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
                this.parseInteractionInputOptions(result, subCommand.options, userInput, structure, interaction);
            }
        } else {
            for (let option of options) {
                if (option.type !== ApplicationCommandOptionType.Subcommand && option.type !== ApplicationCommandOptionType.SubcommandGroup) {
                    result.values[option.name] = option.value;
                }
            }
        }
    }

    private async validateUserInput(parseResult: InputParseResult, userInput: CommandUserInput, structure: CommandInputStructure, guild: Guild): Promise<void> {
        let commandOptions: CommandInputStructureOption[] = this.getOptionsFromCommandTree(parseResult.commandTree, structure);

        if (commandOptions && parseResult.values) {
            for (let option of commandOptions) {
                if (option.type === CommandInputStructureOptionType.subCommand || option.type === CommandInputStructureOptionType.subCommandGroup) {
                    continue;
                }

                this.validateType(parseResult, option);
                this.validateRequired(parseResult, option);
                this.validateChoices(parseResult, option);
                this.validateMaxLength(parseResult, option);
                this.validateMin(parseResult, option);
                this.validateMax(parseResult, option);

                await this.validateUser(parseResult, option, guild);
                await this.validateChannel(parseResult, option, guild);
                await this.validateRole(parseResult, option, guild);
            }
        }
    }

    private addValidation(parseResult: InputParseResult, optionName: string, validation: InputParseValidation): void {
        if (parseResult.validation) {
            if (!parseResult.validation[optionName]) {
                parseResult.validation[optionName] = [];
            }

            parseResult.validation[optionName].push(validation);
        }
    }

    private validateType(parseResult: InputParseResult, option: CommandInputStructureOption): void {
        if (parseResult.values[option.name]) {
            let value: any = parseResult.values[option.name];

            if (option.type === CommandInputStructureOptionType.integer || option.type === CommandInputStructureOptionType.number) {
                let valueNumber: number = Number(value);
                if (isNaN(valueNumber)) {
                    let validationMessage: string = 'Input for "' + option.name + '" needs to be a number.';
                    this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.invalidType, validationMessage));
                }
            }

            if (option.type === CommandInputStructureOptionType.boolean) {
                let valueStringLowered: string = value.toString().toLowerCase();

                if (valueStringLowered) {
                    if (valueStringLowered === '1' || valueStringLowered === '0' || valueStringLowered === 'false' || valueStringLowered === 'true') {
                        let validationMessage: string = 'Input for "' + option.name + '" needs to be a boolean.';
                        this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.invalidType, validationMessage));
                    }
                }
            }
        }
    }

    private validateRequired(parseResult: InputParseResult, option: CommandInputStructureOption): void {
        if (option.required) {
            if (!parseResult.values[option.name]) {
                let validationMessage: string = 'Input for "' + option.name + '" is required.';
                this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.required, validationMessage));
            }
        }
    }

    private validateChoices(parseResult: InputParseResult, option: CommandInputStructureOption): void {
        if (option.choices && option.choices.length > 0) {
            if (parseResult.values[option.name]) {
                let valueLowered: string = parseResult.values[option.name].toString().toLowerCase();
                
                let foundChoice: boolean = false;
                for (let choice of option.choices) {
                    let choiceStringLowered: string = choice[0].toString().toLowerCase();
                    if (valueLowered === choiceStringLowered) {
                        foundChoice = true;
                        break;
                    }
                }

                if (!foundChoice) {
                    let validationMessage: string = 'Choice "' + parseResult.values[option.name].toString() + '" for "' + option.name + '" is not a valid choice.';
                    this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.choices, validationMessage));
                }
            }
        }
    }

    private validateMaxLength(parseResult: InputParseResult, option: CommandInputStructureOption): void {
        if (option.type === CommandInputStructureOptionType.string && option.maxLength && option.maxLength > 0) {
            if (parseResult.values[option.name]) {
                let value: string = parseResult.values[option.name].toString().toLowerCase();
                if (value.length > option.maxLength) {
                    let validationMessage: string = 'Input for "' + option.name + '" is too long. Max length: ' + option.maxLength;
                    this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.maxLength, validationMessage));
                }
            }
        }
    }

    private validateMin(parseResult: InputParseResult, option: CommandInputStructureOption): void {
        if (option.type === CommandInputStructureOptionType.number || option.type === CommandInputStructureOptionType.integer) {
            if (option.min && option.min !== null) {
                if (parseResult.values[option.name]) {
                    let value: number = Number(parseResult.values[option.name]);
                    if (!isNaN(value)) {
                        if (value < option.min) {
                            let validationMessage: string = 'Input for "' + option.name + '" is too low. Min value: ' + option.min;
                            this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.min, validationMessage));
                        }
                    }
                }
            }
        }
    }

    private validateMax(parseResult: InputParseResult, option: CommandInputStructureOption): void {
        if (option.type === CommandInputStructureOptionType.number || option.type === CommandInputStructureOptionType.integer) {
            if (option.max && option.max !== null) {
                if (parseResult.values[option.name]) {
                    let value: number = Number(parseResult.values[option.name]);
                    if (!isNaN(value)) {
                        if (value > option.max) {
                            let validationMessage: string = 'Input for "' + option.name + '" is too low. Max value: ' + option.max;
                            this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.max, validationMessage));
                        }
                    }
                }
            }
        }
    }

    private async validateUser(parseResult: InputParseResult, option: CommandInputStructureOption, guild: Guild): Promise<void> {
        if (option.type === CommandInputStructureOptionType.user) {
            if (parseResult.values[option.name]) {
                let value: string = parseResult.values[option.name].toString();
                value = this.getIdFromMention(value);

                let user: any = await guild.members.fetch(value);
                if (!user) {
                    let validationMessage: string = 'Input for "' + option.name + '" is not a valid user.';
                    this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.invalidContent, validationMessage));
                }
            }
        }
    }

    private async validateChannel(parseResult: InputParseResult, option: CommandInputStructureOption, guild: Guild): Promise<void> {
        if (option.type === CommandInputStructureOptionType.channel) {
            if (parseResult.values[option.name]) {
                let value: string = parseResult.values[option.name].toString();
                value = this.getIdFromMention(value);

                let channel: any = await guild.channels.fetch(value);
                if (!channel) {
                    let validationMessage: string = 'Input for "' + option.name + '" is not a valid channel.';
                    this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.invalidContent, validationMessage));
                }
            }
        }
    }

    private async validateRole(parseResult: InputParseResult, option: CommandInputStructureOption, guild: Guild): Promise<void> {
        if (option.type === CommandInputStructureOptionType.role) {
            if (parseResult.values[option.name]) {
                let value: string = parseResult.values[option.name].toString();
                value = this.getIdFromMention(value);

                let role: any = await guild.roles.fetch(value);
                if (!role) {
                    let validationMessage: string = 'Input for "' + option.name + '" is not a valid role.';
                    this.addValidation(parseResult, option.name, new InputParseValidation(InputParseValidationType.invalidContent, validationMessage));
                }
            }
        }
    }

    private getIdFromMention(mention: string): string {
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

    private getOptionsFromCommandTree(commandTree: string[], structure: CommandInputStructure): CommandInputStructureOption[] {
        let returnOptions: CommandInputStructureOption[] = null;

        let currentOptions: CommandInputStructureOption[] = null;
        let i = 0;
        for (; i < commandTree.length; i++) {
            let commandPart: string = commandTree[i];
            if (i === 0) {
                if (structure.name.toLowerCase() === commandPart.toLowerCase() && structure.options) {
                    currentOptions = structure.options;
                } else {
                    break;
                }
            } else {
                if (currentOptions && currentOptions.length > 0) {
                    let foundOption: boolean = false;
                    for (let option of currentOptions) {
                        if (option.name.toLowerCase() === commandPart.toLowerCase() && option.options) {
                            foundOption = true;
                            currentOptions = option.options;
                            break;
                        }
                    }
                    if (!foundOption) {
                        break;
                    }
                } else {
                    break;
                }                
            }
        }

        if (i === commandTree.length) {
            returnOptions = currentOptions;
        }

        return returnOptions;
    }

    private getOptionValuesFromTree(result: InputParseResult, structure: CommandInputStructure, contentSplit: string[]): void {
        if (result.commandTree.length > 0) {
            let currentOptions: CommandInputStructureOption[];
            let potentialSubCommand: boolean = true;
            for (let i = 0; i < contentSplit.length; i++) {
                if (i === 0) {
                    if (!result.commandTree[0] || structure.name.toLowerCase() !== result.commandTree[0].toLowerCase()) {
                        break;
                    }
                    currentOptions = structure.options;
                } else {
                    if (!result.commandTree[i]) {
                        potentialSubCommand = false;
                    }

                    if (potentialSubCommand) {
                        let commandPart: string = result.commandTree[i];
                        let foundSubCommand: boolean = false;
                        for (let option of currentOptions) {
                            if (option.name.toLowerCase() === commandPart.toLowerCase()) {
                                if (option.type === CommandInputStructureOptionType.subCommandGroup || option.type === CommandInputStructureOptionType.subCommand) {
                                    if (option.options) {
                                        currentOptions = option.options;
                                        foundSubCommand = true;
                                        break;
                                    }
                                }
                            }
                        }
    
                        if (foundSubCommand) {
                            continue;
                        }

                        potentialSubCommand = false;
                    }
                    
                    if (!potentialSubCommand) {
                        let optionIndex: number = i - result.commandTree.length;
                        if (currentOptions[optionIndex] && currentOptions[optionIndex].name && contentSplit[i]) {
                            result.values[currentOptions[optionIndex].name] = contentSplit[i];
                        }
                    }
                }
            }
        }
    }

    private getOptionsInfo(options: CommandInputStructureOption[]): { hasSubCommandGroup?: boolean; hasSubCommand?: boolean; hasBasicOption?: boolean; dictionaryByType?: BasicDictionary<CommandInputStructureOption[]> } {
        let returnOptions: { 
            hasSubCommandGroup?: boolean; 
            hasSubCommand?: boolean; 
            hasBasicOption?: boolean; 
            dictionaryByType?: BasicDictionary<CommandInputStructureOption[]> 
        } = 
        { 
            hasSubCommandGroup: false,
            hasSubCommand: false,
            hasBasicOption: false,
        };
        
        let dictionary: BasicDictionary<CommandInputStructureOption[]> = {};

        for (let option of options) {
            if (!dictionary[option.type]) {
                dictionary[option.type] = [];
            }

            if (option.type === CommandInputStructureOptionType.subCommandGroup) {
                returnOptions.hasSubCommandGroup = true;
            } else if (option.type === CommandInputStructureOptionType.subCommand) {
                returnOptions.hasSubCommand = true;
            } else {
                returnOptions.hasBasicOption = true;
            }

            dictionary[option.type].push(option);
        }

        returnOptions.dictionaryByType = dictionary;

        return returnOptions;
    }

    private getListFromStringArray(arr: string[]): string {
        let message: string = '';

        for (let str of arr) {
            message += '* ' + str + '   ';
        }

        return message;
    }
}