import { Guild } from 'discord.js';

export interface IKeyedCollection<T> {
    add(key: string, value: T);
    containsKey(key: string): boolean;
    count(): number;
    item(key: string): T;
    keys(): string[];
    remove(key: string): T;
    values(): T[];
}

export class KeyedCollection<T> implements IKeyedCollection<T> {
    private items: { [index: string]: T } = {};
 
    private theCount: number = 0;
 
    public containsKey(key: string): boolean {
        return this.items.hasOwnProperty(key);
    }
 
    public count(): number {
        return this.theCount;
    }
 
    public add(key: string, value: T) {
        if (!this.items.hasOwnProperty(key)) {
            this.theCount = this.theCount + 1;
        }             
 
        this.items[key] = value;
    }
 
    public remove(key: string): T {
        let val = this.items[key];
        delete this.items[key];
        this.theCount = this.theCount - 1;

        return val;
    }
 
    public item(key: string): T {
        return this.items[key];
    }
 
    public keys(): string[] {
        let keySet: string[] = [];
 
        // tslint:disable-next-line:no-for-in no-var-keyword
        for (var prop in this.items) {
            if (this.items.hasOwnProperty(prop)) {
                keySet.push(prop);
            }
        }
 
        return keySet;
    }
 
    public values(): T[] {
        let values: T[] = [];
 
        // tslint:disable-next-line:no-for-in no-var-keyword
        for (var prop in this.items) {
            if (this.items.hasOwnProperty(prop)) {
                values.push(this.items[prop]);
            }
        }
 
        return values;
    }
}

export class GuildCollection<T> {
    private collection: KeyedCollection<T> = new KeyedCollection<T>();

    public containsGuildById(guildId: string): boolean {
        return this.collection.containsKey(guildId);
    }

    public containsGuild(guild: Guild): boolean {
        return this.collection.containsKey(guild.id);
    }
 
    public count(): number {
        return this.collection.count();
    }
 
    public addById(guildId: string, value: T) { 
        this.collection.add(guildId, value);
    }

    public add(guild: Guild, value: T) { 
        this.collection.add(guild.id, value);
    }
 
    public removeById(guildId: string): T {
        return this.collection.remove(guildId);
    }

    public remove(guild: Guild): T {
        return this.collection.remove(guild.id);
    }
 
    public itemById(guildId: string): T {
        return this.collection.item(guildId);
    }

    public item(guild: Guild): T {
        return this.collection.item(guild.id);
    }
 
    public guildIds(): string[] {
        return this.collection.keys();
    }
 
    public values(): T[] {
        return this.collection.values();
    }
}
