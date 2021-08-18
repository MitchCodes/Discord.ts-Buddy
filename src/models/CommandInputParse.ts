import { BasicDictionary } from "./BasicDictionary";

export enum InputParseValidationType {
    required = 0,
    maxLength = 1,
    min = 2,
    max = 3,
}

export class InputParseResult {
    public commandTree: string[] = [];
    public values: Record<string, unknown> = {};
    public validation: BasicDictionary<InputParseValidationType[]> = {};
}