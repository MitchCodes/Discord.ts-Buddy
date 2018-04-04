// tslint:disable:no-unnecessary-class

export class GenericErrorCodes {
    public static BASIC_ERROR: string = 'ERROR';
}

export class ErrorWithCode {
    public code: string;
    public message: string;
    public error: Error;

    // tslint:disable-next-line:function-name
    public static buildSimpleError(code: string, message: string, error: Error = null): ErrorWithCode {
        let returnError: ErrorWithCode = new this();
        returnError.code = code;
        returnError.message = message;
        if (error === null) {
            returnError.error = new Error(message);
        } else {
            returnError.error = error;
        }

        return returnError;
    }
}
