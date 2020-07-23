import { MultiGuildBot, CommandParser, ICommandFactory, CommandMatchingSettings, CommandMatchingType } from '../../src/main';
import { TestCommand } from '../models/testcommand';

export class TestBot extends MultiGuildBot {
    public pingPongTimesCalled: number = 0;

    // tslint:disable-next-line:no-unnecessary-override
    public setupBot(): void {
        super.setupBot(); // not calling this does not do default setup code. 
        
        // any setup code (event handling, etc)
    }

    // This overrides the base class function because it does not have any.
    // This does not need to be called directly in this bot so-long as you call 'super.setupBot()' if you override setupBot
    public setupCommands(): CommandParser[] {
        let returnParsers: CommandParser[] = [];
        let availableCommands: ICommandFactory[] = [];

        // set up parser matching settings
        let commandParserSettings: CommandMatchingSettings = new CommandMatchingSettings();
        commandParserSettings.commandPartDelimiter = ' ';
        commandParserSettings.prefix = '!';
        commandParserSettings.matchingType = CommandMatchingType.prefixedOneWord;

        // set up commands
        let pingPongCommand: ICommandFactory = new TestCommand();

        availableCommands.push(pingPongCommand);
        
        // set up parser(s)
        returnParsers.push(new CommandParser(commandParserSettings, availableCommands));
        
        this.botInfo('Commands are setup.');

        return returnParsers;
    }
}