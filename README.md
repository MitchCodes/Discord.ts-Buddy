# Discord.ts-Buddy

## Disclaimer

This package is developed for using [TypeScript](http://www.typescriptlang.org/) in Node. Some of the below features may not be very helpful when working in a purely JavaScript environment.

## About

The purpose of this package is to provide code helpers to speed up the development time of developing Discord bots using [Discord.js](https://discord.js.org). There are a number of common features and requirements that most bots have such as commands and being able to auto-restart. The helpers this package provides intend to make it faster for bot developers to get to what they're good at: actually adding features.

If you are looking for a boilerplate example project that shows you how to use this library, you can go [here](https://github.com/MitchCodes/Discord.ts-Buddy-Boilerplate).

## Helper Features

* Bot manager that handles auto-restarting for you.
* Command parser using the command design pattern that allows you to create command classes and plug them into bots.
* A basic permission system to assign permissions to commands.
* A fleshed-out multi-guild bot that you can extend and bend to your will that has features such as:
    * Status tracking.
    * Command parser logic to easily plug in commands with permissions.
* A basic messenger service that will send out messages using an embed look-and-feel (as of this moment).
* A GuildCollection generic class that acts as a dictionary for any kind of object using a guild as a key.
* An Azure Storage Manager generic class that makes life much easier when trying to use the JavaScript version of Azure Table Storage.
    * Semi-smart-caching feature which allows you to optionally cache your data for a certain time-span when querying.
        * Self-clean-up!
    * Definitely considered(ing) making this a separate package so you get two for one here if you use Azure Table Storage!

## Development Notes

If you intend to contribute to this repository, here are some relevant notes:

### Visual Studio Code

This project was created using Visual Studio Code. As for extensions, the jest extension is definitely helpful. The launch.json file was tricky to get working with Jest so below there is an example of the one that is working well for me.

#### _launch.json example:_

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "launch",
            "name": "Launch Program",
            "program": "${workspaceFolder}/src\\main.ts",
            "outFiles": [
               "${workspaceFolder}/build/**/*.js"
            ],
            "sourceMaps": true
        },
        {
            "name": "Debug Jest Tests",
            "type": "node",
            "request": "launch",
            "port":9222,
            "cwd": "${workspaceRoot}",
            "runtimeArgs": ["--inspect=9222",
                "${workspaceRoot}/node_modules/jest/bin/jest.js",
                "--config",
                "${workspaceRoot}/jest.config.js",
                "--runInBand",
                "--coverage",
                "false",
                "--no-cache"],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen",
            "sourceMaps": true,
            "outFiles": [
                "${workspaceFolder}/build/**/*.js",
                "${workspaceFolder}/__tests__/**/*"
            ],
            "env":{
                "NO_WEBPACK_MIDDLEWARE": "false"
            }
        }
    ]
}
```