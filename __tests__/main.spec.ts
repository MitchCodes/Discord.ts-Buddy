import { MainController } from '../src/logic/main.controller';
import * as wins from 'winston';
import * as nconf from 'nconf';

describe('maincontroller tests', () => {
  // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content
  jest.useFakeTimers();

  let mainController: MainController;

  // Act before assertions
  beforeAll(async () => {
    jest.runOnlyPendingTimers();
    mainController = new MainController();

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
    mainController.startProgram(logger, nconf);
  });

  it('create main controller and start program', () => {
    expect(mainController).toBeDefined();
  });

});
