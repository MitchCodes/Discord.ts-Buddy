const nconf = require('nconf');
import { CommandMessageParser } from '../src/logic/command.logic';
import { TestCommand } from './models/testcommand';
import { ICommand, CommandMatchingSettings, CommandMatchingType } from '../src/models/Command';
import { StringHelper } from '../src/logic/helpers/string.helper';

describe('maincontroller tests', () => {
  // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content
  jest.useFakeTimers();

  // Act before assertions
  beforeAll(async () => {
    jest.runOnlyPendingTimers();

    nconf.file({ file: '../config.common.json' });
    nconf.defaults({
      botTokens: [],
    });
  });

  // tslint:disable-next-line:mocha-unneeded-done
  it('test command parser prefixed', async () => {
    let availableCommands: ICommand[] = [];

    // set up parser matching settings
    let commandParserSettings: CommandMatchingSettings = new CommandMatchingSettings();
    commandParserSettings.commandPartDelimiter = ' ';
    commandParserSettings.prefix = '!';
    commandParserSettings.matchingType = CommandMatchingType.prefixedOneWord;

    // set up commands
    let pingPongTestCommand: ICommand = new TestCommand();
    await pingPongTestCommand.setupInputSettings(null);
    availableCommands.push(pingPongTestCommand);
    
    // set up parser
    let parser: CommandMessageParser = new CommandMessageParser(availableCommands);

    let gotCommands: ICommand[] = parser.getCommandsForMessageInput('!ping');
    let commandCasted: TestCommand = <TestCommand><unknown>gotCommands[0];

    expect(commandCasted).not.toBeUndefined();
    expect(commandCasted).not.toBeNull();

    expect(parser.getCommandsForMessageInput('^ping').length).toBe(0);

    expect(commandCasted.testIsSet).toBeFalsy();
    
    // Create mock input and bot for testing
    const mockBot = {
      pingPongTimesCalled: 0
    };
    const mockInput = {
      msg: {
        content: '!ping',
        channel: null
      }
    };
    
    await commandCasted.execute(mockBot as any, mockInput as any);
    expect(commandCasted.testIsSet).toBeTruthy();
  });

  it('test string helper', () => {
    let longString: string = 'this is a long string I hope that this splits into more than one because that would be great.';
    let stringHelper: StringHelper = new StringHelper();
    let splitString: string[] = stringHelper.splitStringIfLengthExceeds(longString, 75);
    expect(splitString.length === 2).toBeTruthy();
    let combinedString: string = splitString[0] + splitString[1];
    expect(combinedString === longString).toBeTruthy();
  });

});
