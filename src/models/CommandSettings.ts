export interface ICommandSettings {
    getSettings(): Promise<CommandSetting[]>;
}

export interface ICommandSettingsBot {
    getSettingsCallback: (botId: string, guildId: string) => Promise<BotCommandSetting[]>;
    saveSettingCallback: (commandSetting: BotCommandSetting) => Promise<boolean>;
}

export enum CommandSettingType {
    rawData = 0,
    user = 1,
    role = 2,
    channel = 3,
}

export class BotCommandSetting {
    public name: string;
    public guildId: string;
    public botId: string;
    public value: unknown | Array<unknown>;
}

export class CommandSetting {
    public name: string;
    public description: string;
    public type: CommandSettingType = CommandSettingType.rawData;
    public isList: boolean = false;
    public value: unknown | Array<unknown>;

    public isStringSetting(): this is CommandStringSetting {
        let commandString: CommandStringSetting = (this as CommandStringSetting);
        return typeof commandString.value === "string";
    }

    public isStringArraySetting(): this is CommandStringArraySetting {
        let commandString: CommandStringArraySetting = (this as CommandStringArraySetting);
        
        let isStringSetting: boolean = false;

        if (!isStringSetting) {
            if (Array.isArray(commandString.value)) {
                let somethingIsNotRight: boolean = false;
                commandString.value.forEach(function(item){
                   if (typeof item !== 'string') {
                    somethingIsNotRight = true;
                   }
                })
                if(!somethingIsNotRight){
                    isStringSetting = true;
                }
             }
        }

        return isStringSetting;
    }
}

export class CommandStringSetting extends CommandSetting {
    public value: string;
}

export class CommandStringArraySetting extends CommandSetting {
    public value: Array<string>;
    public isList: boolean = true;
}