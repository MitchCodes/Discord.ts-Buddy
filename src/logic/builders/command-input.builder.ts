/* eslint-disable @typescript-eslint/no-explicit-any */
import { SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder } from "@discordjs/builders";
import { CommandMatchingSettings, CommandMatchingType } from "../../models/Command";
import { CommandInputStructure, CommandInputStructureOption, CommandInputStructureOptionType } from "../../models/CommandInputStructure";

export class CommandInputBuilder {
    public input: CommandInputStructure;

    public constructor(input: CommandInputStructure = null) {
        if (input) {
            this.input = input;
        } else {
            this.input = new CommandInputStructure();
        }
    }

    public setName(name: string): CommandInputBuilder {
        this.input.name = name;
        return this;
    }

    public setDescription(description: string): CommandInputBuilder {
        this.input.description = description;
        return this;
    }

    public setMessageInputPrefix(prefix: string): CommandInputBuilder {
        this.input.prefix = prefix;
        return this;
    }

    public addSubCommandGroup(builder: (subCommandGroup: CommandInputSubCommandGroupBuilder) => void): CommandInputBuilder {
        let option: CommandInputStructureOption = new CommandInputStructureOption();
        option.type = CommandInputStructureOptionType.subCommandGroup;

        this.input.options.push(option);

        let subCommandGroupBuilder: CommandInputSubCommandGroupBuilder = new CommandInputSubCommandGroupBuilder(this, option)
        builder(subCommandGroupBuilder);

        return this;
    }

    public addSubCommand(builder: (subCommand: CommandInputSubCommandBuilder) => void): CommandInputBuilder {
        let option: CommandInputStructureOption = new CommandInputStructureOption();
        option.type = CommandInputStructureOptionType.subCommand;

        this.input.options.push(option);

        let subCommandBuilder: CommandInputSubCommandBuilder = new CommandInputSubCommandBuilder(this, option)
        builder(subCommandBuilder);

        return this;
    }

    public addOption(builder: (option: CommandInputOptionBuilder) => void): CommandInputBuilder {
        let option: CommandInputStructureOption = new CommandInputStructureOption();

        this.input.options.push(option);

        let optionBuilder: CommandInputOptionBuilder = new CommandInputOptionBuilder(this, option)
        builder(optionBuilder);

        return this;
    }

    public toSlashCommandBuilder(): SlashCommandBuilder {
        let slashCommandBuilder: SlashCommandBuilder = new SlashCommandBuilder();

        if (this.input.name) {
            slashCommandBuilder.setName(this.input.name);
        }

        if (this.input.description) {
            slashCommandBuilder.setDescription(this.input.description);
        }

        if (this.input.options) {
            for (let option of this.input.options) {
                switch (option.type) {
                    case CommandInputStructureOptionType.subCommandGroup:
                        slashCommandBuilder.addSubcommandGroup((subCommandGroupBuilder: SlashCommandSubcommandGroupBuilder) => {
                            this.createSlashCommandBuilderSubCommandGroup(subCommandGroupBuilder, option);
                            return subCommandGroupBuilder;
                        })
                        break;
                    case CommandInputStructureOptionType.subCommand:
                        slashCommandBuilder.addSubcommand((subCommandBuilder: SlashCommandSubcommandBuilder) => {
                            this.createSlashCommandBuilderSubCommand(subCommandBuilder, option);
                            return subCommandBuilder;
                        })
                        break;
                    default:
                        this.createSlashCommandBuilderOption(slashCommandBuilder, option);
                        break;
                }
            }
        }

        return slashCommandBuilder;
    }

    public getMessageMatchingSettings(matchingType: CommandMatchingType = CommandMatchingType.prefixedOneWord, commandPartDelimiter: string = ' '): CommandMatchingSettings {
        let matchingSettings: CommandMatchingSettings = new CommandMatchingSettings();

        if (this.input.prefix) {
            matchingSettings.prefix = this.input.prefix;
        } else {
            matchingSettings.prefix = '!';
        }

        if (this.input.name) {
            matchingSettings.commandMatchText = this.input.name;
        }

        matchingSettings.matchingType = matchingType;
        matchingSettings.commandPartDelimiter = commandPartDelimiter;

        return matchingSettings;
    }

    private createSlashCommandBuilderSubCommandGroup(builder: SlashCommandSubcommandGroupBuilder, option: CommandInputStructureOption) {
        if (option.name) {
            builder.setName(option.name);
        }

        if (option.description) {
            builder.setDescription(option.description);
        }

        if (option.options) {
            for (let curOption of option.options) {
                switch (curOption.type) {
                    case CommandInputStructureOptionType.subCommand:
                        builder.addSubcommand((subCommandBuilder: SlashCommandSubcommandBuilder) => {
                            this.createSlashCommandBuilderSubCommand(subCommandBuilder, curOption);
                            return subCommandBuilder;
                        })
                        break;
                }
            }
        }
    }

    private createSlashCommandBuilderSubCommand(builder: SlashCommandSubcommandBuilder, option: CommandInputStructureOption) {
        if (option.name) {
            builder.setName(option.name);
        }

        if (option.description) {
            builder.setDescription(option.description);
        }

        if (option.options) {
            for (let curOption of option.options) {
                this.createSlashCommandBuilderOption(builder, curOption);
            }
        }
    }

    private createSlashCommandBuilderOption(builder: SlashCommandBuilder | SlashCommandSubcommandBuilder, option: CommandInputStructureOption) {
        switch (option.type) {
            case CommandInputStructureOptionType.string:
                builder.addStringOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
            case CommandInputStructureOptionType.integer:
                builder.addIntegerOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
            case CommandInputStructureOptionType.number: // seems to not have a builder option
                builder.addStringOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
            case CommandInputStructureOptionType.boolean:
                builder.addStringOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
            case CommandInputStructureOptionType.user:
                builder.addUserOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
            case CommandInputStructureOptionType.channel:
                builder.addChannelOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
            case CommandInputStructureOptionType.role:
                builder.addRoleOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
            case CommandInputStructureOptionType.mentionable:
                builder.addMentionableOption((optionBuilder) => {
                    this.createSlashCommandBuilderOptionDetails(optionBuilder, option);
                    return optionBuilder;
                });
                break;
        }
    }

    private createSlashCommandBuilderOptionDetails(builder: any, option: CommandInputStructureOption) {
        if (option.name && builder.setName) {
            builder.setName(option.name);
        }

        if (option.description && builder.setDescription) {
            builder.setDescription(option.description);
        }

        if (builder.setRequired) {
            builder.setRequired(option.required);
        }

        if (option.choices && option.choices.length > 0 && builder.addChoices) {
            builder.addChoices(option.choices);
        }
    }
}

export class CommandInputSubCommandGroupBuilder {
    private rootBuilder: CommandInputBuilder;
    private option: CommandInputStructureOption;

    public constructor(rootBuilder: CommandInputBuilder, option: CommandInputStructureOption) {
        this.rootBuilder = rootBuilder;
        this.option = option;
    }

    public setName(name: string): CommandInputSubCommandGroupBuilder {
        this.option.name = name;
        return this;
    }

    public setDescription(description: string): CommandInputSubCommandGroupBuilder {
        this.option.description = description;
        return this;
    }

    public addSubCommand(builder: (subCommand: CommandInputSubCommandBuilder) => void): CommandInputSubCommandGroupBuilder {
        let option: CommandInputStructureOption = new CommandInputStructureOption();
        option.type = CommandInputStructureOptionType.subCommand;

        if (!this.option.options) {
            this.option.options = [];
        }
        this.option.options.push(option);

        let subCommandBuilder: CommandInputSubCommandBuilder = new CommandInputSubCommandBuilder(this.rootBuilder, option)
        builder(subCommandBuilder);

        return this;
    }
}

export class CommandInputSubCommandBuilder {
    private rootBuilder: CommandInputBuilder;
    private option: CommandInputStructureOption;

    public constructor(rootBuilder: CommandInputBuilder, option: CommandInputStructureOption) {
        this.rootBuilder = rootBuilder;
        this.option = option;
    }

    public setName(name: string): CommandInputSubCommandBuilder {
        this.option.name = name;
        return this;
    }

    public setDescription(description: string): CommandInputSubCommandBuilder {
        this.option.description = description;
        return this;
    }

    public addOption(builder: (option: CommandInputOptionBuilder) => void): CommandInputSubCommandBuilder {
        let option: CommandInputStructureOption = new CommandInputStructureOption();

        if (!this.option.options) {
            this.option.options = [];
        }
        this.option.options.push(option);

        let optionBuilder: CommandInputOptionBuilder = new CommandInputOptionBuilder(this.rootBuilder, option)
        builder(optionBuilder);

        return this;
    }
}

export class CommandInputOptionBuilder {
    private rootBuilder: CommandInputBuilder;
    private option: CommandInputStructureOption;

    public constructor(rootBuilder: CommandInputBuilder, option: CommandInputStructureOption) {
        this.rootBuilder = rootBuilder;
        this.option = option;
    }

    public setType(type: CommandInputStructureOptionType): CommandInputOptionBuilder {
        this.option.type = type;
        return this;
    }

    public setName(name: string): CommandInputOptionBuilder {
        this.option.name = name;
        return this;
    }

    public setDescription(description: string): CommandInputOptionBuilder {
        this.option.description = description;
        return this;
    }

    public setRequired(required: boolean): CommandInputOptionBuilder {
        this.option.required = required;
        return this;
    }

    public setChoices(choices: [name: string, value: string][] | [name: string, value: number][]): CommandInputOptionBuilder {
        this.option.choices = choices;
        return this;
    }

    public setMaxLength(maxLength: number): CommandInputOptionBuilder {
        this.option.maxLength = maxLength;
        return this;
    }

    public setMin(min: number): CommandInputOptionBuilder {
        this.option.min = min;
        return this;
    }

    public setMax(max: number): CommandInputOptionBuilder {
        this.option.max = max;
        return this;
    }
}