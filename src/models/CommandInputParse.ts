import { BasicDictionary } from "./BasicDictionary";

export enum InputParseValidationType {
    required = 0,
    maxLength = 1,
    min = 2,
    max = 3,
    choices = 4,
    invalidType = 5,
    invalidContent = 6,
}

export class InputParseResult {
    public missingArguments: boolean = false;
    public tooManyArguments: boolean = false;
    public commandTree: string[] = [];
    public values: Record<string, unknown> = {};
    public validation: BasicDictionary<InputParseValidation[]> = {};
}

export class InputParseValidation {
    public type: InputParseValidationType;
    public message: string;

    public constructor(type: InputParseValidationType, message: string) {
        this.type = type;
        this.message = message;
    }
}