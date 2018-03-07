import { TableService, ErrorOrResult, TableUtilities } from 'azure-storage';

export interface IAzureSavable {
    partitionKey: string;
    rowKey: string;
    classVersion: number;
    handleVersionChange(inputObject: Object, inputVersion: number, latestVersion: number): boolean;
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
    private overrideTableService: TableService = null;
    private testType: new () => T;

    public constructor(testType: new () => T, azureStorageAccount: string = '', 
                       azureStorageKey: string = '', overrideTableService: TableService = null) {
        this.testType = testType;
        this.azureStorageAccount = azureStorageAccount;
        this.azureStorageKey = azureStorageKey;
        this.overrideTableService = overrideTableService;

        if (overrideTableService !== null) {
            this.tblService = overrideTableService;
        }
    }

    public convertToAzureObj(obj: T): Object {
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
            if (keyType === 'function' || keyType === 'symbol' || keyType === 'undefined') {
                continue;
            } else if (keyType === 'object') {
                if (obj[key] instanceof Date) {
                    returnObj[key] = entGen.DateTime(<Date>obj[key]);
                } else {
                    continue;
                }
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

    public convertFromAzureObjToObject(azureObj: Object): Object {
        let returnObj: Object = {};

        let azureObjectKeys: string[] = Object.keys(azureObj);

        // tslint:disable-next-line:no-string-literal
        returnObj['partitionKey'] = azureObj['PartitionKey']._;
        // tslint:disable-next-line:no-string-literal
        returnObj['rowKey'] = azureObj['RowKey']._;
        
        for (let key of azureObjectKeys) {
            if (key === 'PartitionKey' || key === 'RowKey') {
                continue;
            }
            returnObj[key] = azureObj[key]._;
        }

        return returnObj;
    }

    public convertFromObjToType(obj: Object): T {
        let returnObj: T = this.getNew();

        let objectKeys: string[] = Object.keys(obj);
        
        for (let key of objectKeys) {
            returnObj[key] = obj[key];
        }

        return returnObj;
    }

    public initiateTableService() {
        if (this.overrideTableService === null) {
            if (this.azureStorageAccount !== '' && this.azureStorageKey !== '') {
                this.tblService = new TableService(this.azureStorageAccount, this.azureStorageKey);
            } else {
                this.tblService = new TableService();
            }
        }
    }

    public updateModel(inputObject: Object) {
        let newModel: T = this.getNew();
        // tslint:disable-next-line:no-string-literal
        let inputVersion: number = inputObject['classVersion'];
        let updated: boolean = newModel.handleVersionChange(inputObject, inputVersion, newModel.classVersion);
        if (updated) {
            // tslint:disable-next-line:no-string-literal
            inputObject['classVersion'] = newModel.classVersion;
        }
    }

    private getNew(): T {
        return new this.testType();
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

}
