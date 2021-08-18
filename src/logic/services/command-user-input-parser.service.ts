import { CommandUserInput } from "../../models/Command";
import { InputParseResult, InputParseValidationType } from "../../models/CommandInputParse";
import { CommandInputStructure } from "../../models/CommandInputStructure";

export class CommandUserInputParserService {
    public async parseUserInput(userInput: CommandUserInput, structure: CommandInputStructure): Promise<InputParseResult> {
        let parseResult: InputParseResult = new InputParseResult();
        // handle message option optionals (not required)
        // if one is optional and then one is required, how to know which input is which
        // validate, if message, that there is no required options after an optional one. throw if it happens


        return parseResult;
    }

    public isValid(parseResult: InputParseResult): boolean {
        let validationOptions: string[] = Object.keys(parseResult.validation);
        for (let validationOption of validationOptions) {
            let validationTypes: InputParseValidationType[] = parseResult.validation[validationOption];
            if (validationTypes && validationTypes.length > 0) {
                return false;
            }
        }

        return true;
    }

    public getDefaultValidationMessage(parseResult: InputParseResult): string {
        let validationMessage: string = '';

        return validationMessage;
    }
}