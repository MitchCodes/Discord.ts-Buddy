import { TableService, ErrorOrResult, TableUtilities, ExponentialRetryPolicyFilter, 
    createTableService, TableQuery, TableBatch } from 'azure-storage';

export interface AzureDictionary<T> {
    [K: string]: T;
}

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

// tslint:disable-next-line:no-stateless-class no-unnecessary-class max-classes-per-file
export class AzureGlobalBatch {
    public batch: TableBatch;
    public tblService: TableService;
    public tableName: string;
}

// tslint:disable-next-line:no-stateless-class no-unnecessary-class max-classes-per-file
export class AzureInstanceBatch {
    public batch: TableBatch;
    public tableName: string;
}

export enum AzureBatchType {
    instance = 0,
    global = 1,
}

// tslint:disable-next-line:no-stateless-class no-unnecessary-class max-classes-per-file
export class AzureStorageManager<T extends IAzureSavable> {
    private static globalBatches: AzureDictionary<AzureGlobalBatch> = {};
    private tblService: TableService = null;
    private azureStorageAccount: string = '';
    private azureStorageKey: string = '';
    private overrideTableService: TableService = null;
    private testType: new () => T;
    private instanceBatches: AzureDictionary<AzureInstanceBatch> = {};

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

    public saveMany(tableName: string, input: T[]): Promise<IAzureResult> {
        return new Promise<AzureResult<any>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<any>) => void) => {
            let batchId: string = this.newGuid();
            this.createBatch(batchId, tableName, AzureBatchType.instance);
            for (let curObj of input) {
                this.addBatchSave(batchId, curObj, AzureBatchType.instance);
            }
            this.executeBatch(batchId, AzureBatchType.instance).then((res: AzureResult<any>) => {
                resolve(res);
            }).catch((err: AzureResult<any>) => {
                reject(err);
            });
        });
    }

    public getByPartitionAndRowKey(tableName: string, partitionKey: string, rowKey: string): Promise<AzureResult<T>> {
        return new Promise<AzureResult<T>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<T>) => void) => {
            let tableQuery: TableQuery = new TableQuery().where('PartitionKey eq ?', partitionKey).and('RowKey eq ?', rowKey);
            this.executeQuery(tableName, tableQuery).then((success: AzureResult<T>) => {
                resolve(success);
            }).catch((err: AzureResult<T>) => {
                reject(err);
            });
        });
    }

    public getByPartitionKey(tableName: string, partitionKey: string): Promise<AzureResult<T>> {
        return new Promise<AzureResult<T>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<T>) => void) => {
            let tableQuery: TableQuery = new TableQuery().where('PartitionKey eq ?', partitionKey);
            this.executeQuery(tableName, tableQuery).then((success: AzureResult<T>) => {
                resolve(success);
            }).catch((err: AzureResult<T>) => {
                reject(err);
            });
        });
    }

    public getByQuery(tableName: string, query: TableQuery): Promise<AzureResult<T>> {
        return new Promise<AzureResult<T>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<T>) => void) => {
            this.executeQuery(tableName, query).then((success: AzureResult<T>) => {
                resolve(success);
            }).catch((err: AzureResult<T>) => {
                reject(err);
            });
        });
    }

    public remove(tableName: string, objToRemove: T): Promise<AzureResult<T>> {
        return new Promise<AzureResult<T>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<T>) => void) => {
            this.removeObj(tableName, objToRemove).then((success: AzureResult<T>) => {
                resolve(success);
            }).catch((err: AzureResult<T>) => {
                reject(err);
            });
        });
    }

    public removeMany(tableName: string, input: T[]): Promise<IAzureResult> {
        return new Promise<AzureResult<any>>((resolve : (val: AzureResult<T>) => void, reject : (val: AzureResult<any>) => void) => {
            let batchId: string = this.newGuid();
            this.createBatch(batchId, tableName, AzureBatchType.instance);
            for (let curObj of input) {
                this.addBatchRemove(batchId, curObj, AzureBatchType.instance);
            }
            this.executeBatch(batchId, AzureBatchType.instance).then((res: AzureResult<any>) => {
                resolve(res);
            }).catch((err: AzureResult<any>) => {
                reject(err);
            });
        });
    }

    public addBatchRemove(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): boolean {
        return this.removeObjBatch(batchName, obj, batchType);
    }

    public getBatch(batchName: string, batchType: AzureBatchType = AzureBatchType.instance): TableBatch {
        switch (batchType) {
            case AzureBatchType.global:
                let azureGlobalBatch: AzureGlobalBatch = AzureStorageManager.globalBatches[batchName];
                if (azureGlobalBatch !== undefined && azureGlobalBatch !== null) {
                    return azureGlobalBatch.batch;
                } else {
                    return null;
                }
            case AzureBatchType.instance:
                let azureInstanceBatch: AzureInstanceBatch = this.instanceBatches[batchName];
                if (azureInstanceBatch !== undefined && azureInstanceBatch !== null) {
                    return azureInstanceBatch.batch;
                } else {
                    return null;
                }
            default:
                return null;
        }
    }

    public createBatch(batchName: string, tableName: string, batchType: AzureBatchType = AzureBatchType.instance): void {
        switch (batchType) {
            case AzureBatchType.global:
                let newAzureGlobalBatch: AzureGlobalBatch = new AzureGlobalBatch();
                newAzureGlobalBatch.batch = new TableBatch();
                newAzureGlobalBatch.tblService = this.tblService;
                newAzureGlobalBatch.tableName = tableName;
                AzureStorageManager.globalBatches[batchName] = newAzureGlobalBatch;
                break;
            case AzureBatchType.instance:
                let newAzureInstanceBatch: AzureInstanceBatch = new AzureInstanceBatch();
                newAzureInstanceBatch.batch = new TableBatch();
                newAzureInstanceBatch.tableName = tableName;
                this.instanceBatches[batchName] = newAzureInstanceBatch;
                break;
            default:
        }
    }

    public executeBatch(batchName: string, batchType: AzureBatchType = AzureBatchType.instance): Promise<AzureResult<any>> {
        // tslint:disable-next-line:promise-must-complete
        return new Promise<AzureResult<any>>((resolve : (val: AzureResult<any>) => void, reject : (val: AzureResult<any>) => void) => {
            let batchToUse: TableBatch = null;
            let tblServiceToUse: TableService = null;
            let tblToUse: string = null;
            switch (batchType) {
                case AzureBatchType.global:
                    let azureGlobalBatch: AzureGlobalBatch = AzureStorageManager.globalBatches[batchName];
                    if (azureGlobalBatch !== undefined && azureGlobalBatch !== null) {
                        batchToUse = azureGlobalBatch.batch;
                        tblServiceToUse = azureGlobalBatch.tblService;
                        tblToUse = azureGlobalBatch.tableName;
                    }
                    break;
                case AzureBatchType.instance:
                    let azureInstanceBatch: AzureInstanceBatch = this.instanceBatches[batchName];
                    if (azureInstanceBatch !== undefined && azureInstanceBatch !== null) {
                        batchToUse = azureInstanceBatch.batch;
                        tblServiceToUse = this.tblService;
                        tblToUse = azureInstanceBatch.tableName;
                    }
                    break;
                default:
            }

            if (batchToUse !== null && tblServiceToUse !== null && tblToUse !== null) {
                tblServiceToUse.executeBatch(tblToUse, batchToUse, (err: any, result: any, response: any) => {
                    if (!err) {
                        let batchSuccessResult: AzureResult<any> = new AzureResult<any>();
                        batchSuccessResult.status = AzureResultStatus.success;
                        batchSuccessResult.message = 'Successfully executed batch';
                        batchSuccessResult.data = result;
                        this.removeBatch(batchName, batchType);
                        resolve(batchSuccessResult);
                    } else {
                        let batchErrResult: AzureResult<any> = new AzureResult<any>();
                        batchErrResult.error = new Error(err);
                        batchErrResult.message = err;
                        batchErrResult.status = AzureResultStatus.error;
                        reject(batchErrResult);
                    }
                });
            } else {
                let nullBatchOrTblServResult: AzureResult<any> = new AzureResult<any>();
                nullBatchOrTblServResult.status = AzureResultStatus.error;
                nullBatchOrTblServResult.message = 'Error: Table Batch, Table Service or Table is null.';
                nullBatchOrTblServResult.error = new Error('Error: Table Batch, Table Service or Table is null.');
                reject(nullBatchOrTblServResult);
            }
        });
    }

    public addBatchSave(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): boolean {
        return this.insertOrReplaceObjBatch(batchName, obj, batchType);
    }

    private removeBatch(batchName: string, batchType: AzureBatchType = AzureBatchType.instance): void {
        switch (batchType) {
            case AzureBatchType.global:
                AzureStorageManager.globalBatches[batchName] = undefined;
                break;
            case AzureBatchType.instance:
                this.instanceBatches[batchName] = undefined;
                break;
            default:
        }
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

    private insertOrReplaceObjBatch(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): boolean { 
        let batch: TableBatch = this.getBatch(batchName, batchType);
        if (batch !== undefined && batch !== null) {
            let azureObj = this.convertToAzureObj(obj);
            batch.insertOrReplaceEntity(azureObj);

            return true;
        }

        return false;
    }

    private removeObj(tableName: string, obj: T): Promise<IAzureResult> {
        return new Promise<IAzureResult>((resolve : (val: IAzureResult) => void, reject : (val: IAzureResult) => void) => {
            let azureResult: AzureResult<T> = new AzureResult<T>();
            let azureObj = this.convertToAzureObjOnlyKeys(obj);
            this.tblService.deleteEntity(tableName, azureObj, {}, (error: any, response: any) => {
                if (error) {
                    azureResult.status = AzureResultStatus.error;
                    azureResult.message = 'Error deleting entity: ' + error;
                    azureResult.error = new Error('Error deleting entity: ' + error);
                    reject(azureResult);
                } else {
                    azureResult.status = AzureResultStatus.success;
                    resolve(azureResult);
                }
            });
        });
    }

    private removeObjBatch(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): boolean {
        let batch: TableBatch = this.getBatch(batchName, batchType);
        if (batch !== undefined && batch !== null) {
            let azureObj = this.convertToAzureObjOnlyKeys(obj);
            batch.deleteEntity(azureObj);

            return true;
        }

        return false;
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

    private convertToAzureObjOnlyKeys(obj: T): Object {
        let entGen = TableUtilities.entityGenerator;
        let returnObj: Object = {};
        // tslint:disable-next-line:no-string-literal
        returnObj['PartitionKey'] = entGen.String(obj.partitionKey);
        // tslint:disable-next-line:no-string-literal
        returnObj['RowKey'] = entGen.String(obj.rowKey);

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

    private newGuid(): string {
        return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + this.s4() + this.s4();
    }

    private s4() {
        // tslint:disable-next-line:insecure-random binary-expression-operand-order
        return Math.floor((1 + Math.random()) * 0x10000) .toString(16).substring(1);
    }

    // private getObjBasedOnPartitionKey(partitionKey: string) {
        
    // }

}
