import { MultiGuildBot, CommandMatchingSettings, CommandMatchingType } from '../../src/main';
import { ICommand, ICommandFactory } from '../../src/models/Command';
import { TestCommand } from '../models/testcommand';
import { EchoCommand } from '../models/testcommandthree';
import { TestCommandTwo } from '../models/testcommandtwo';

export class TestBot extends MultiGuildBot {
    public pingPongTimesCalled: number = 0;

    // tslint:disable-next-line:no-unnecessary-override
    public setupBot(): void {
        super.setupBot(); // not calling this does not do default setup code. 
        
        // any setup code (event handling, etc)
    }

    // This overrides the base class function because it does not have any.
    // This does not need to be called directly in this bot so-long as you call 'super.setupBot()' if you override setupBot
    public setupCommands(): ICommand[] {
        let returnCommands: ICommand[] = [];

        // set up commands
        let pingPongCommand: ICommand = new TestCommand();
        let echoCommand: ICommand = new EchoCommand();

        returnCommands.push(pingPongCommand);
        returnCommands.push(echoCommand);
        
        this.botInfo('Commands are setup.');

        return returnCommands;
    }
}