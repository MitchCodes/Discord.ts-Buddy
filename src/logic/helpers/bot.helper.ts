/* eslint-disable @typescript-eslint/ban-types */
import { ICommandFactory } from "../../models/Command";

export class BotHelper {
    public hasCommandFactory(command: Object): command is ICommandFactory {
        return 'createCommand' in command;
    }
}