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
}
