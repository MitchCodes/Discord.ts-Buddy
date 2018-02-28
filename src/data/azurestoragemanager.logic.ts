import { TableService, ErrorOrResult, TableUtilities } from 'azure-storage';

export interface IAzureSavable {
    partitionKey: string;
    rowKey: string;
}

export enum AzureResultStatus {
    pending = 0,
    executing = 1,
    success = 2,
    error = 3,
}

export interface IAzureResult {
    status: AzureResultStatus;
    error: Error;
    message: string;
}

export class AzureResult implements IAzureResult {
    public status: AzureResultStatus;
    public error: Error;
    public message: string;

    public constructor() {
        this.status = AzureResultStatus.pending;
    }
}

// tslint:disable-next-line:no-stateless-class no-unnecessary-class
export class AzureStorageManager<T extends IAzureSavable> {
    private tblService: TableService = null;
    private azureStorageAccount: string = '';
    private azureStorageKey: string = '';

    public constructor(azureStorageAccount: string = '', azureStorageKey: string = '', passedTblService: TableService = null) {
        if (this.tblService === null) {
            if (passedTblService !== null) {
                this.tblService = passedTblService;
            } else {
                this.initiateTableService(azureStorageAccount, azureStorageKey, passedTblService);
            }
        }
    }

    private initiateTableService(azureStorageAccount: string = '', azureStorageKey: string = '', passedTblService: TableService = null) {
        this.azureStorageAccount = azureStorageAccount;
        this.azureStorageKey = azureStorageKey;
        if (this.azureStorageAccount !== '' && azureStorageKey !== '') {
            this.tblService = new TableService(this.azureStorageAccount, this.azureStorageKey);
        } else {
            this.tblService = new TableService();
        }
    }

    private insertOrReplaceObj(tableName: string, obj: T): Promise<IAzureResult> {
        return new Promise<IAzureResult>((resolve : (val: IAzureResult) => void, reject : (val: IAzureResult) => void) => {
            let azureResult: AzureResult = new AzureResult();
            azureResult.status = AzureResultStatus.executing;
            let azureObj = this.convertToAzureObj(obj);
            this.tblService.insertEntity(tableName, azureObj, {}, (error: any, result: any, response: any) => {
                if (error) {
                    azureResult.status = AzureResultStatus.error;
                    azureResult.message = 'Error inserting new entity: ' + error;
                    azureResult.error = new Error('Error inserting new entity: ' + error);
                    reject(azureResult);
                } else {
                    azureResult.status = AzureResultStatus.success;
                    resolve(azureResult);
                }
            });
        });
    }

    // private getObjBasedOnPartitionKey(partitionKey: string) {
        
    // }

    private convertToAzureObj(obj: T): Object {
        let entGen = TableUtilities.entityGenerator;
        let returnObj: Object = {};
        let objectKeys: string[] = Object.keys(obj);
        // tslint:disable-next-line:no-string-literal
        returnObj['PartitionKey'] = entGen.String(obj.partitionKey);
        // tslint:disable-next-line:no-string-literal
        returnObj['RowKey'] = entGen.String(obj.rowKey);
        for (let key of objectKeys) {
            if (key === 'partitionKey' || key === 'rowKey') {
                continue;
            }
            let keyType = typeof obj[key];
            if (keyType === 'function' || keyType === 'symbol') {
                continue;
            } else if (keyType === 'object') {
                if (obj[key] instanceof Date) {
                    returnObj[key] = entGen.DateTime(<Date>obj[key]);
                } else {
                    continue;
                }
            } else if (keyType === 'undefined') {
                returnObj[key] = entGen.String('');
            } else if (keyType === 'boolean') {
                returnObj[key] = entGen.Boolean(obj[key]);
            } else if (keyType === 'number') {
                if (Number.isSafeInteger(obj[key])) {
                    returnObj[key] = entGen.Int64(obj[key]);
                } else {
                    returnObj[key] = entGen.Double(obj[key]);
                }
            } else if (keyType === 'string') {
                returnObj[key] = entGen.String(obj[key]);
            } else {
                continue;
            }
        }    

        return returnObj;
    }

    private convertFromAzureObj(azureObj: Object): T {
        
        return <T>azureObj;
    }

}
