import { TableService, ErrorOrResult, TableUtilities, ExponentialRetryPolicyFilter, createTableService, TableQuery } from 'azure-storage';

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
    data: any;
}

export class AzureResult<T extends IAzureSavable> implements IAzureResult {
    public status: AzureResultStatus;
    public error: Error;
    public message: string;
    public data: T[];

    public constructor() {
        this.status = AzureResultStatus.pending;
        this.data = [];
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

    public initializeConnection(): void {
        if (this.overrideTableService === null) {
            let retryFilter: ExponentialRetryPolicyFilter = new ExponentialRetryPolicyFilter(0, 300, 300, 10000);
            if (this.azureStorageAccount !== '' && this.azureStorageKey !== '') {
                this.tblService = new TableService(this.azureStorageAccount, this.azureStorageKey).withFilter(retryFilter);
            } else {
                this.tblService = new TableService().withFilter(retryFilter);
            }
        }
    }

    public createTableIfNotExists(tableName: string): Promise<IAzureResult> {
        return new Promise<IAzureResult>((resolve : (val: IAzureResult) => void, reject : (val: IAzureResult) => void) => {
            let result: AzureResult<T> = new AzureResult<T>();
            if (this.tblService !== null) {
                this.tblService.createTableIfNotExists(tableName, (createError: any, createResult: any, createResponse: any) => {
                    if (!createError) {
                        result.status = AzureResultStatus.success;
                        result.message = 'Succesfully created table if it does not exist.';
                        resolve(result);
                    } else {
                        result.error = new Error('Error creating table ' + tableName + ': ' + createError);
                        result.message = 'Error creating table ' + tableName + ': ' + createError;
                        reject(result);
                    }
                });
            } else {
                result.status = AzureResultStatus.error;
                result.message = 'Table service was null';
                result.error = new Error('Table service was null');
                reject(result);
            }
        });
    }

    public save(tableName: string, input: T): Promise<IAzureResult> {
        return this.insertOrReplaceObj(tableName, input);
    }

    public getByPartitionAndRowKey(tableName: string, partitionKey: string, rowKey: string): Promise<AzureResult<T>>  {
        return new Promise<AzureResult<T>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<T>) => void) => {
            let tableQuery: TableQuery = new TableQuery().where('PartitionKey eq ?', partitionKey).and('RowKey eq ?', rowKey);
            this.executeQuery(tableName, tableQuery).then((success: AzureResult<T>) => {
                resolve(success);
            }).catch((err: AzureResult<T>) => {
                reject(err);
            });
        });
    }

    private executeQuery(tableName: string, tableQuery: TableQuery): Promise<AzureResult<T>> {
        return new Promise<AzureResult<T>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<T>) => void) => {
            this.executeQueryContinuation(tableName, tableQuery, [], null).then((success: AzureResult<T>) => {
                resolve(success);
            }).catch((err: AzureResult<T>) => {
                reject(err);
            });
        });
    }

    private executeQueryContinuation(tableName: string, tableQuery: TableQuery, 
                                     dataArray: T[], contToken: TableService.TableContinuationToken): Promise<AzureResult<T>> {
        return new Promise<AzureResult<T>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<T>) => void) => {
            if (this.tblService === undefined || this.tblService === null) {
                let tblServiceNullResult: AzureResult<T> = new AzureResult<T>();
                tblServiceNullResult.status = AzureResultStatus.error;
                tblServiceNullResult.error = new Error('Table service is not defined for querying');
                tblServiceNullResult.message = 'Table service is not defined for querying';
                reject(tblServiceNullResult);
            }
            this.tblService.queryEntities(tableName, tableQuery, contToken, (error: any, result: any, response: any) => {
                if (!error) {
                    for (let entry of result.entries) {
                        let normalObject: Object = this.convertFromAzureObjToObject(entry);
                        this.updateModel(normalObject); // update the model for migration purposes
                        dataArray.push(this.convertFromObjToType(normalObject));
                    }
                    if (result.continuationToken !== null) {
                        // tslint:disable-next-line:max-line-length
                        this.executeQueryContinuation(tableName, tableQuery, dataArray, result.continuationToken).then((success: AzureResult<T>) => {
                            resolve(success);
                        }).catch((err: AzureResult<T>) => {
                            reject(err);
                        });
                    } else {
                        let finishDataResult: AzureResult<T> = new AzureResult<T>();
                        finishDataResult.status = AzureResultStatus.success;
                        finishDataResult.message = 'Successfully queried data';
                        finishDataResult.data = dataArray;
                        resolve(finishDataResult);
                    }
                } else {
                    // tslint:disable-next-line:no-console
                    console.log(error);
                    let queryErrorResult: AzureResult<T> = new AzureResult<T>();
                    queryErrorResult.error = new Error(error);
                    queryErrorResult.message = error;
                    queryErrorResult.status = AzureResultStatus.error;
                    reject(queryErrorResult);
                }
            });
        });
    }

    private updateModel(inputObject: Object): void {
        let newModel: T = this.getNew();
        let inputVersion: number = -1;
        // tslint:disable-next-line:no-string-literal
        if (inputObject['classVersion'] !== undefined && inputObject['classVersion'] !== null) {
            // tslint:disable-next-line:no-string-literal
            inputVersion = inputObject['classVersion'];
        }
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
            let azureResult: AzureResult<T> = new AzureResult<T>();
            azureResult.status = AzureResultStatus.executing;
            let azureObj = this.convertToAzureObj(obj);
            this.tblService.insertOrReplaceEntity(tableName, azureObj, {}, (error: any, result: any, response: any) => {
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

    private convertFromAzureObjToObject(azureObj: Object): Object {
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

    private convertFromObjToType(obj: Object): T {
        let returnObj: T = this.getNew();

        let objectKeys: string[] = Object.keys(obj);
        
        for (let key of objectKeys) {
            returnObj[key] = obj[key];
        }

        return returnObj;
    }

    // private getObjBasedOnPartitionKey(partitionKey: string) {
        
    // }

}
