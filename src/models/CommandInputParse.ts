import { BasicDictionary } from "./BasicDictionary";

export class InputParseResult {
    public commandTree: string[] = [];
    public values: Record<string, unknown> = {};
}