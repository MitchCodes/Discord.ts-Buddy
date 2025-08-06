# Discord.ts-Buddy

## Disclaimer

This package is developed for using [TypeScript](http://www.typescriptlang.org/) in Node. Some of the below features may not be very helpful when working in a purely JavaScript environment.

## About

The purpose of this package is to provide code helpers to speed up the development time of developing Discord bots using [Discord.js](https://discord.js.org). There are a number of common features and requirements that most bots have such as commands and being able to auto-restart. The helpers this package provides intend to make it faster for bot developers to get to what they're good at: actually adding features.

## Helper Features

* Bot manager that handles auto-restarting for you.
* Command parser using the command design pattern that allows you to create command classes and plug them into bots.
* A basic permission system to assign permissions to commands.
* A fleshed-out multi-guild bot that you can extend and bend to your will that has features such as:
    * Status tracking.
    * Command parser logic to easily plug in commands with permissions.
* A GuildCollection generic class that acts as a dictionary for any kind of object using a guild as a key.
* Sound play service that makes playing files to voice channels easy.
```