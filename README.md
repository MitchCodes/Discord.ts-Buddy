# Discord.ts-Buddy

## Disclaimer

This package is developed for using [TypeScript](http://www.typescriptlang.org/) in Node. Some of the below features may not be very helpful when working in a purely JavaScript environment.

## About

The purpose of this package is to provide code helpers to speed up the development time of developing Discord bots using [Discord.js](https://discord.js.org). There are a number of common features and requirements that most bots have such as commands and being able to auto-restart. The helpers this package provides intend to make it faster for bot developers to get to what they're good at: actually adding features.

Not only is this GitHub repository available on npm as a package that you can add to your project but it is also available as an example of how you can setup your bot's development environment with TypeScript, webpack and unit testing using Jest.

## Requirements

>To-do... a sad day indeed.

## Usage

>To-do :(.... I need to push stuff to npm and try using it in another package before I write this out.

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
    * Definitely considered making this a separate package so you get two for one here if you use Azure Table Storage!

## Example Repository Features

Here are the features that this repository has that I think could be useful as an example:

* Fully-featured package.json with every necessary Discord.js dependency for production.
* All code written in TypeScript.
* Webpack for building the application for deployments
* Optional [configuration file setup](#configuration-file-setup) that works together with webpack when building to development and production.
* Dockerfile _(coming soon!)_ for creating an image to easily spin up a container with the bot.
* Unit tests using Jest
    * Separated jest configuration files to allow different commands for testing. This was done because the Azure and Discord.js tests require network access and configuration.

## Configuration File Setup

This section is only relevant if you are trying to use this repository as a boiler-plate.

There are three optional files that you can create in the root folder next to package.json and the like:
* _config.common.json_
    * Necessary to have if you want to have a dev or prod specific config file.
* _config.dev.json_
* _config.prod.json_

On build, webpack will take the config.common.json file (if it exists) and merge it with the appropriate dev or prod file (if they exist) depending on whether you built with `npm run build` or `npm run build-prod`.

If you use this repository and want to run Discord.js and Azure unit tests using the associated commands, configuration for them will be necessary. This configuration would have to be put in the _config.common.json_ file. Here is an example of what a configuration for use with the unit tests would look like:

```json
{
    "test": {
        "bots": {
            "mainBotToken": "<token here>",
            "secondBotToken": "<token here>",
            "testDiscordGuildId": "<id here>",
            "testDiscordVoiceChannelName": "<channel name (such as 'General') here>"
        },
        "azure": {
            "testAccount": "<test azure table storage account name>",
            "testAccountKey": "<test azure table storage account key>",
            "testTable": "<test azure table storage table name>"
        }
    }
}
```

## IDE Notes

This was developed using Visual Studio Code so that is the one that I will talk about although any IDE would work.

### Visual Studio Code

The jest extension is definitely helpful. The launch.json file was tricky to get working with Jest so below there is an example of the one that is working well for me.

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