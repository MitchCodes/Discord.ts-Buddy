export class CommandInputStructure {
    public name: string;
    public description: string;
    public prefix: string;
    public options: CommandInputStructureOption[] = [];
}

export enum CommandInputStructureOptionType {
    subCommand = 0,
    subCommandGroup = 1,
    string = 2,
    integer = 3,
    number = 4,
    boolean = 5,
    user = 6,
    channel = 7,
    role = 8,
    mentionable = 9,
}

export class CommandInputStructureOption {
    public type: CommandInputStructureOptionType;
    public name: string;
    public description: string;
    public required?: boolean = false;
    public choices?: [name: string, value: string][] | [name: string, value: number][];
    public options?: CommandInputStructureOption[] = null;
    public maxLength?: number = null;
    public min?: number = null;
    public max?: number = null;
}