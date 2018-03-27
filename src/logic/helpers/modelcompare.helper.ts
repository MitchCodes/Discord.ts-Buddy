export class ModelComparer<T> {
    public propertiesAreEqualToFirst(first: T, second: T, ignoreObjects: boolean = false): boolean {
        let firstObjectKeys: string[] = Object.keys(first);
        let secondObjectKeys: string[] = Object.keys(second);

        for (let key of firstObjectKeys) {
            let keyType = typeof first[key];
            let keyTypeSecond = typeof second[key];

            if (keyType === 'undefined' && keyTypeSecond === 'undefined') {
                continue;
            }
            
            let isFuncOrSymbolOrIgnoredObject: boolean = false;
            // tslint:disable-next-line:cyclomatic-complexity
            if (keyType === 'function' || keyType === 'symbol' || (ignoreObjects && keyType === 'object')) {
                isFuncOrSymbolOrIgnoredObject = true;
            }

            // tslint:disable-next-line:cyclomatic-complexity
            if (keyTypeSecond === 'function' || keyTypeSecond === 'symbol' || (ignoreObjects && keyTypeSecond === 'object')) {
                isFuncOrSymbolOrIgnoredObject = true;
            }

            if (isFuncOrSymbolOrIgnoredObject) {
                continue;
            }

            if (keyType !== keyTypeSecond) {
                return false;
            }

            if (keyType === 'object' && first[key] instanceof Date && second[key] instanceof Date) {
                if (first[key].getTime() === second[key].getTime()) {
                    continue;
                } else {
                    return false;
                }
            }

            if (first[key] !== second[key]) {
                return false;
            }
        }

        return true;
    }
}
