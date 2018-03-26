import * as wins from 'winston';
import * as nconf from 'nconf';
import { CommandParser } from '../src/logic/command.logic';
import { TestCommand } from './models/testcommand';
import { ICommand, ICommandFactory, ICommandResult, CommandResult, CommandResultStatus, 
          CommandMatchingSettings, CommandMatchingType } from '../src/models/Command';
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

    let logger = new wins.Logger({
      level: 'debug',
      transports: [
        new (wins.transports.Console)(),
      ],
    });
  });

  // tslint:disable-next-line:mocha-unneeded-done
  it('test command parser prefixed', (done: any) => {
    let availableCommands: ICommandFactory[] = [];

    // set up parser matching settings
    let commandParserSettings: CommandMatchingSettings = new CommandMatchingSettings();
    commandParserSettings.commandPartDelimiter = ' ';
    commandParserSettings.prefix = '!';
    commandParserSettings.matchingType = CommandMatchingType.prefixedOneWord;

    // set up commands
    let pingPongTestCommand: ICommandFactory = new TestCommand();
    availableCommands.push(pingPongTestCommand);
    
    // set up parser
    let parser: CommandParser = new CommandParser(commandParserSettings, availableCommands);

    let gotCommand: ICommand = parser.parseCommand('!ping pong');
    let commandCasted: TestCommand = <TestCommand>gotCommand;

    expect(gotCommand).not.toBeUndefined();
    expect(gotCommand).not.toBeNull();

    expect(parser.parseCommand('^ping pong')).toBeNull();

    expect(commandCasted.testIsSet).toBeFalsy();
    gotCommand.execute(null, null);
    expect(commandCasted.testIsSet).toBeTruthy();
    
    done();
  });

  // tslint:disable-next-line:mocha-unneeded-done
  it('test command parser exact match', (done: any) => {
    let availableCommands: ICommandFactory[] = [];

    // set up parser matching settings
    let commandParserSettings: CommandMatchingSettings = new CommandMatchingSettings();
    commandParserSettings.matchingType = CommandMatchingType.exactMatch;

    // set up commands
    let pingPongTestCommand: ICommandFactory = new TestCommand();
    availableCommands.push(pingPongTestCommand);
    
    // set up parser
    let parser: CommandParser = new CommandParser(commandParserSettings, availableCommands);

    let gotCommand: ICommand = parser.parseCommand('ping');
    let commandCasted: TestCommand = <TestCommand>gotCommand;

    expect(gotCommand).not.toBeUndefined();
    expect(gotCommand).not.toBeNull();

    expect(parser.parseCommand('!ping')).toBeNull();

    expect(commandCasted.testIsSet).toBeFalsy();
    gotCommand.execute(null, null);
    expect(commandCasted.testIsSet).toBeFalsy();
    
    done();
  });

  // tslint:disable-next-line:mocha-unneeded-done
  it('test command parser add available after creation', (done: any) => {
    let availableCommands: ICommandFactory[] = [];

    // set up parser matching settings
    let commandParserSettings: CommandMatchingSettings = new CommandMatchingSettings();
    commandParserSettings.matchingType = CommandMatchingType.exactMatch;

    // set up commands
    let pingPongTestCommand: ICommandFactory = new TestCommand();
    
    // set up parser
    let parser: CommandParser = new CommandParser(commandParserSettings, availableCommands);

    let gotCommand: ICommand = parser.parseCommand('ping');

    expect(gotCommand).toBeNull();

    expect(parser.parseCommand('!ping')).toBeNull();

    parser.addAvailableCommand(pingPongTestCommand);

    gotCommand = parser.parseCommand('ping');
    let commandCasted: TestCommand = <TestCommand>gotCommand;

    expect(gotCommand).not.toBeNull();

    expect(commandCasted.testIsSet).toBeFalsy();
    gotCommand.execute(null, null);
    expect(commandCasted.testIsSet).toBeFalsy();
    
    done();
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
