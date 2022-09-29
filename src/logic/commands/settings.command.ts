import { RESTPostAPIApplicationCommandsJSONBody, Interaction, CacheType, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { Provider } from "nconf";
import { ILogger } from "tsdatautils-core";
import { CommandResult, CommandResultStatus, ICommand, ICommandResult } from "../../models/Command";
import { InputParseResult } from "../../models/CommandInputParse";
import { BotCommandSetting, CommandSetting, CommandSettingType } from "../../models/CommandSettings";
import { IDiscordBot } from "../../models/DiscordBot";
import { MultiGuildBot } from "../bots/multi-guild-bot";
import { CommandReplyService } from "../services/command-reply.service";
import { InteractionCommand } from "./interaction.command";

export class SettingsCommand extends InteractionCommand {
    private commandSettings: CommandSetting[] = null;
    private bot: IDiscordBot;
    private getSettingsCallback: (botId: string, guildId: string) => Promise<BotCommandSetting[]>;
    private saveSettingCallback: (commandSetting: BotCommandSetting) => Promise<boolean>;
    
    public constructor(commandName: string, commandDescription: string, logger: ILogger, configProvider: Provider, bot: IDiscordBot, commandSettings: CommandSetting[], 
        getSettingsCallback: (botId: string, guildId: string) => Promise<BotCommandSetting[]>, 
        saveSettingCallback: (commandSetting: BotCommandSetting) => Promise<boolean>) {

        super(commandName, commandDescription, logger, configProvider);

        this.deferReply = false;
        this.bot = bot;
        this.commandSettings = commandSettings;
        this.getSettingsCallback = getSettingsCallback;
        this.saveSettingCallback = saveSettingCallback;

        if (!this.getSettingsCallback || !this.saveSettingCallback) {
            throw new Error('The get and save setting callback functions must be defined');
        }
    }

    public makeCommand(): ICommand {
        return new SettingsCommand(this.commandName, this.commandDescription, this.logger, this.configProvider, this.bot, this.commandSettings, this.getSettingsCallback, this.saveSettingCallback);
    }

    public getCommandBuilder(): RESTPostAPIApplicationCommandsJSONBody {
        let slashCommandBuilder: SlashCommandBuilder = new SlashCommandBuilder();
        slashCommandBuilder.setName('settings')
            .setDescription(this.commandDescription)
            .setDMPermission(false)
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand(subCommand => {
                return subCommand.setName('list')
                    .setDescription('List available settings');
            })
            .addSubcommand(subCommand => {
                subCommand.setName('get')
                    .setDescription('Get a current setting value')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                        }

                        return input;
                    });
                return subCommand;
            });

        let hasRawSetting: boolean = false;
        let hasRawListSetting: boolean = false;
        let hasUserSetting: boolean = false;
        let hasUserListSetting: boolean = false;
        let hasRoleSetting: boolean = false;
        let hasRoleListSetting: boolean = false;
        let hasChannelSetting: boolean = false;
        let hasChannelListSetting: boolean = false;
        for (let commandSetting of this.commandSettings) {
            if (commandSetting.type === CommandSettingType.rawData) {
                if (commandSetting.isList) {
                    hasRawListSetting = true;
                } else {
                    hasRawSetting = true;
                }
            } else if (commandSetting.type === CommandSettingType.user) {
                if (commandSetting.isList) {
                    hasUserListSetting = true;
                } else {
                    hasUserSetting = true;
                }
            } else if (commandSetting.type === CommandSettingType.role) {
                if (commandSetting.isList) {
                    hasRoleListSetting = true;
                } else {
                    hasRoleSetting = true;
                }
            } else if (commandSetting.type === CommandSettingType.channel) {
                if (commandSetting.isList) {
                    hasChannelListSetting = true;
                } else {
                    hasChannelSetting = true;
                }
            }
        }

        if (hasRawSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('set')
                    .setDescription('Set a setting to a new value')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (!commandSetting.isList && commandSetting.type === CommandSettingType.rawData) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addStringOption(input => {
                        return input.setName('value')
                            .setDescription('Setting value')
                            .setRequired(true);
                    });
                });
        }

        if (hasRawListSetting || hasUserListSetting || hasRoleListSetting || hasChannelListSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('resetlist')
                    .setDescription('Reset a list to 0 entries')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (commandSetting.isList) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    });
            });
        }
        
        if (hasRawListSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('addlist')
                    .setDescription('Add a value to a list')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (commandSetting.isList && commandSetting.type === CommandSettingType.rawData) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addStringOption(input => {
                        return input.setName('value')
                            .setDescription('Value to add to the setting list')
                            .setRequired(true);
                    });
            });
        }


        if (hasUserSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('setuser')
                    .setDescription('Set a user setting to a new value')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('User setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (!commandSetting.isList && commandSetting.type === CommandSettingType.user) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addUserOption(input => {
                        return input.setName('value')
                            .setDescription('User value')
                            .setRequired(true);
                    });
                });
        }

        if (hasUserListSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('adduserlist')
                    .setDescription('Add a user to a user list')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (commandSetting.isList && commandSetting.type === CommandSettingType.user) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addUserOption(input => {
                        return input.setName('value')
                            .setDescription('User to add to the setting list')
                            .setRequired(true);
                    });
            });
        }

        if (hasRoleSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('setrole')
                    .setDescription('Set a role setting to a new value')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Role setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (!commandSetting.isList && commandSetting.type === CommandSettingType.role) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addRoleOption(input => {
                        return input.setName('value')
                            .setDescription('Role value')
                            .setRequired(true);
                    });
                });
        }

        if (hasRoleListSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('addrolelist')
                    .setDescription('Add a role to a role list')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (commandSetting.isList && commandSetting.type === CommandSettingType.role) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addRoleOption(input => {
                        return input.setName('value')
                            .setDescription('Role to add to the setting list')
                            .setRequired(true);
                    });
            });
        }
        
        if (hasChannelSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('setchannel')
                    .setDescription('Set a channel setting to a new value')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Channel setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (!commandSetting.isList && commandSetting.type === CommandSettingType.channel) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addChannelOption(input => {
                        return input.setName('value')
                            .setDescription('Channel value')
                            .setRequired(true);
                    })
                });
        }

        if (hasChannelListSetting) {
            slashCommandBuilder.addSubcommand(subCommand => {
                return subCommand.setName('addchannellist')
                    .setDescription('Add a channel to a channel list')
                    .addStringOption(input => {
                        input.setName('name')
                            .setDescription('Setting name')
                            .setRequired(true);
                        
                        for (let commandSetting of this.commandSettings) {
                            if (commandSetting.isList && commandSetting.type === CommandSettingType.channel) {
                                input.addChoices({ name: commandSetting.name, value: commandSetting.name });
                            }
                        }
    
                        return input;
                    })
                    .addChannelOption(input => {
                        return input.setName('value')
                            .setDescription('Channel to add to the setting list')
                            .setRequired(true);
                    });
            });
        }

        return slashCommandBuilder.toJSON();
    }

    public async executeInteraction(bot: IDiscordBot, input: Interaction<CacheType>, inputParseResult: InputParseResult, replyService: CommandReplyService): Promise<ICommandResult> {
        let result: ICommandResult = new CommandResult(CommandResultStatus.success);

        await replyService.deferReply(input, true);

        let subCommand: string = inputParseResult.commandTree[1];

        switch (subCommand) {
            case 'list':
                return this.listSettings(bot, input, inputParseResult, replyService);
            case 'get':
                return this.getSetting(bot, input, inputParseResult, replyService);
            case 'set':
            case 'setuser':
            case 'setrole':
            case 'setchannel':
                return this.setSetting(bot, input, inputParseResult, replyService);
            case 'addlist':
            case 'adduserlist':
            case 'addrolelist':
            case 'addchannellist':
                return this.addSettingList(bot, input, inputParseResult, replyService);
            case 'resetlist':
                return this.resetList(bot, input, inputParseResult, replyService);
        }

        return result;
    }

    private async listSettings(bot: IDiscordBot, input: Interaction<CacheType>, inputParseResult: InputParseResult, replyService: CommandReplyService): Promise<ICommandResult> {
        let result: ICommandResult = new CommandResult(CommandResultStatus.success);
        let message: string = 'Settings:\n\n';
        
        for (let setting of this.commandSettings) {
            message += ' * ' + setting.name + ' - Type: ' + this.getSettingTypeDescription(setting.type) + (setting.isList ? ' List' : '') + ' - ' + setting.description + '\n';
        }

        replyService.replyAfterDefer(input, { content: message, ephemeral: true });

        return result;
    }

    private async getSetting(bot: IDiscordBot, input: Interaction<CacheType>, inputParseResult: InputParseResult, replyService: CommandReplyService): Promise<ICommandResult> {
        let result: ICommandResult = new CommandResult(CommandResultStatus.success);

        let multiGuildBot: MultiGuildBot = <MultiGuildBot>bot;
        let botId: string = multiGuildBot.botClient.user.id;
        let guildId: string = input.guild.id;

        let savedSettings: BotCommandSetting[] = await this.getSettingsCallback(botId, guildId);
        let settingsDictionary: Record<string, CommandSetting> = this.createSettingDictionary(this.commandSettings);
        let savedSettingsDictionary: Record<string, BotCommandSetting> = this.createBotSettingDictionary(savedSettings);

        let settingValue: string = 'Unset';
        let settingName: string = <string>inputParseResult.values['name'];
        if (settingName && savedSettingsDictionary[settingName] && settingsDictionary[settingName]) {
            let savedSetting: BotCommandSetting = savedSettingsDictionary[settingName];
            let setting: CommandSetting = settingsDictionary[settingName];

            if (savedSetting && setting) {
                if (setting.type === CommandSettingType.rawData) {
                    settingValue = <string>savedSetting.value;
                } else if (setting.type === CommandSettingType.role ||
                    setting.type === CommandSettingType.user ||
                    setting.type === CommandSettingType.channel) {
                    settingValue = '<@' + <string>savedSetting.value + '>';
                }
            }
        }

        let message: string = 'Setting value: ' + settingValue;
        replyService.replyAfterDefer(input, { content: message, ephemeral: true });

        return result;
    }

    private async setSetting(bot: IDiscordBot, input: Interaction<CacheType>, inputParseResult: InputParseResult, replyService: CommandReplyService): Promise<ICommandResult> {
        let result: ICommandResult = new CommandResult(CommandResultStatus.success);

        let multiGuildBot: MultiGuildBot = <MultiGuildBot>bot;
        let botId: string = multiGuildBot.botClient.user.id;
        let guildId: string = input.guild.id;

        let savedSettings: BotCommandSetting[] = await this.getSettingsCallback(botId, guildId);
        let savedSettingsDictionary: Record<string, BotCommandSetting> = this.createBotSettingDictionary(savedSettings);

        let settingName: string = <string>inputParseResult.values['name'];
        let settingValue: string = <string>inputParseResult.values['value'];

        let commandToSave: BotCommandSetting = null;
        if (savedSettingsDictionary[settingName]) {
            commandToSave = savedSettingsDictionary[settingName];
        } else {
            commandToSave = new BotCommandSetting();
        }

        commandToSave.name = settingName;
        commandToSave.botId = botId;
        commandToSave.guildId = guildId;
        commandToSave.value = settingValue;

        await this.saveSettingCallback(commandToSave);

        let message: string = 'Setting saved.';
        replyService.replyAfterDefer(input, { content: message, ephemeral: true });

        return result;
    }

    private async addSettingList(bot: IDiscordBot, input: Interaction<CacheType>, inputParseResult: InputParseResult, replyService: CommandReplyService): Promise<ICommandResult> {
        let result: ICommandResult = new CommandResult(CommandResultStatus.success);

        let multiGuildBot: MultiGuildBot = <MultiGuildBot>bot;
        let botId: string = multiGuildBot.botClient.user.id;
        let guildId: string = input.guild.id;

        let savedSettings: BotCommandSetting[] = await this.getSettingsCallback(botId, guildId);
        let savedSettingsDictionary: Record<string, BotCommandSetting> = this.createBotSettingDictionary(savedSettings);

        let settingName: string = <string>inputParseResult.values['name'];
        let settingValue: string = <string>inputParseResult.values['value'];

        let commandToSave: BotCommandSetting = null;
        if (savedSettingsDictionary[settingName]) {
            commandToSave = savedSettingsDictionary[settingName];
            if (!commandToSave.value) {
                commandToSave.value = [];
            }
        } else {
            commandToSave = new BotCommandSetting();
            commandToSave.value = [];
        }

        commandToSave.name = settingName;
        commandToSave.botId = botId;
        commandToSave.guildId = guildId;
        (<Array<unknown>>commandToSave.value).push(settingValue);

        await this.saveSettingCallback(commandToSave);

        let message: string = 'Setting saved.';
        replyService.replyAfterDefer(input, { content: message, ephemeral: true });

        return result;
    }

    private async resetList(bot: IDiscordBot, input: Interaction<CacheType>, inputParseResult: InputParseResult, replyService: CommandReplyService): Promise<ICommandResult> {
        let result: ICommandResult = new CommandResult(CommandResultStatus.success);

        let multiGuildBot: MultiGuildBot = <MultiGuildBot>bot;
        let botId: string = multiGuildBot.botClient.user.id;
        let guildId: string = input.guild.id;

        let settingName: string = <string>inputParseResult.values['name'];

        let commandToSave: BotCommandSetting = new BotCommandSetting();
        commandToSave.name = settingName;
        commandToSave.botId = botId;
        commandToSave.guildId = guildId;
        commandToSave.value = [];

        await this.saveSettingCallback(commandToSave);

        let message: string = 'Setting saved.';
        replyService.replyAfterDefer(input, { content: message, ephemeral: true });

        return result;
    }

    private getSettingTypeDescription(type: CommandSettingType): string {
        switch (type) {
            case CommandSettingType.rawData:
                return 'Basic';
            case CommandSettingType.user:
                return 'User';
            case CommandSettingType.role:
                return 'Role';
            case CommandSettingType.channel:
                return 'Channel';
        }

        return '';
    }

    private createSettingDictionary(settings: CommandSetting[]): Record<string, CommandSetting> {
        let returnDictionary: Record<string, CommandSetting> = {};
        
        for (let setting of settings) {
            returnDictionary[setting.name] = setting;
        }

        return returnDictionary;
    }

    private createBotSettingDictionary(settings: BotCommandSetting[]): Record<string, BotCommandSetting> {
        let returnDictionary: Record<string, BotCommandSetting> = {};
        
        for (let setting of settings) {
            returnDictionary[setting.name] = setting;
        }

        return returnDictionary;
    }
}