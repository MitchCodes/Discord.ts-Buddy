/* eslint-disable @typescript-eslint/no-explicit-any */
export class StringHelper {
    public splitStringIfLengthExceeds(text: string, maxLength: number): string[] {
        let returnSplitString: string[] = [];
        if (text.length > maxLength) {
            let textAsArray: string[] = text.split('');
            while (textAsArray.length !== 0) {
                returnSplitString.push(textAsArray.splice(0, maxLength).join(''));
            }
        } else {
            returnSplitString.push(text);
        }

        return returnSplitString;
    }

    public splitSpacesWithQuotes(input: string): string[] {
        return input.match(/\\?.|^$/g).reduce((p, c) => {
            if(c === '"'){
                (<any>p).quote ^= 1;
            }else if(!(<any>p).quote && c === ' '){
                p.a.push('');
            }else{
                p.a[p.a.length-1] += c.replace(/\\(.)/,"$1");
            }
            return  p;
        }, {a: ['']}).a;
    }
}
