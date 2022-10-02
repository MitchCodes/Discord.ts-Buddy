import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join, isAbsolute, extname, dirname } from 'path';

export class FileObjectService {
    public async deleteAllFiles(directoryPath: string): Promise<boolean> {
        let files: string[] = readdirSync(directoryPath);

        for (let file of files) {
            rmSync(file);
        }

        return true;
    }

    public async getFromFile<T>(filePath: string): Promise<T> {
        let fullPath: string = await this.getFinalPath(filePath);
        if (!existsSync(fullPath)) {
            return null;
        }

        let objString: string = readFileSync(fullPath).toString();
        let parsedObj: unknown = JSON.parse(objString);

        return <T>parsedObj;
    }

    public async setToFile<T>(filePath: string, obj: T): Promise<void> {
        let fullPath: string = await this.getFinalPath(filePath);

        let objJson: string = JSON.stringify(obj);
        writeFileSync(fullPath, objJson);
    }

    private async getFinalPath(path: string): Promise<string> {
        let finalPath: string = '';
        if (isAbsolute(path)) {
            finalPath = path;
        } else {
            finalPath = join('data', path);
        }

        let ext: string = extname(finalPath);
        let extLower: string = ext.toLowerCase();
        if (extLower !== 'json') {
            finalPath = finalPath + '.json';
        }

        let dirName: string = dirname(finalPath);
        if (!existsSync(dirName)) {
            mkdirSync(dirName, { recursive: true });
        }

        return finalPath;
    }
}