import { CommandSetting, CommandSettingType } from "../../models/CommandSettings";

export class CommandSettingsBuilder {
    private settingBuilders: CommandSettingBuilder[];

    public constructor() {
        this.settingBuilders = [];
    }

    public addSetting(settingBuilder: (setting: CommandSettingBuilder) => CommandSettingBuilder): CommandSettingsBuilder {
        let newBuilder: CommandSettingBuilder = new CommandSettingBuilder();
        this.settingBuilders.push(settingBuilder(newBuilder));

        return this;
    }

    public toCommandSettings(): CommandSetting[] {
        let settings: CommandSetting[] = [];

        for (let settingBuilder of this.settingBuilders) {
            settings.push(settingBuilder.toCommandSetting());
        }

        return settings;
    }
}

export class CommandSettingBuilder {
    private setting: CommandSetting;

    public constructor() {
        this.setting = new CommandSetting();
    }

    public setName(name: string): CommandSettingBuilder {
        this.setting.name = name;
        return this;
    }

    public setDescription(description: string): CommandSettingBuilder {
        this.setting.description = description;
        return this;
    }

    public setType(type: CommandSettingType): CommandSettingBuilder {
        this.setting.type = type;
        return this;
    }

    public setIsList(isList: boolean): CommandSettingBuilder {
        this.setting.isList = isList;
        return this;
    }

    public setAnyValue(value: unknown | Array<unknown>): CommandSettingBuilder {
        this.setting.value = value;
        return this;
    }

    public setStringValue(value: string | string[]): CommandSettingBuilder {
        this.setting.value = value;
        return this;
    }

    public toCommandSetting(): CommandSetting {
        return this.setting;
    }
}