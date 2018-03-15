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

export interface IAzureBatch {
    currentBatch: TableBatch;
    totalBatches: TableBatch[];
    tblService: TableService;
    tableName: string;
    partitionName: string;
}

export class AzureBatch implements IAzureBatch {
    public currentBatch: TableBatch;
    public totalBatches: TableBatch[];
    public tblService: TableService;
    public tableName: string;
    public partitionName: string = null;

    public constructor() {
        this.totalBatches = [];
    }
}

export class AzureBatchResult {
    public batch: TableBatch;
    public result: IAzureResult;
}

// tslint:disable-next-line:max-classes-per-file
export class AzureBatchResults {
    public results: AzureBatchResult[];
    public overallStatus: AzureBatchResultStatus;

    public constructor() {
        this.results = [];
    }

    public getFailedTableBatches(): TableBatch[] {
        let returnCol: TableBatch[] = [];

        for (let res of this.results) {
            if (res.result.status === AzureResultStatus.error) {
                returnCol.push(res.batch);
            }
        }

        return returnCol;
    }
}

export enum AzureBatchResultStatus {
    allError = 0,
    partialSuccess = 1,
    allSuccess = 2,
}

export enum AzureBatchType {
    instance = 0,
    global = 1,
}

// tslint:disable-next-line:no-stateless-class no-unnecessary-class max-classes-per-file
export class AzureStorageManager<T extends IAzureSavable> {
    private static globalBatches: AzureDictionary<IAzureBatch> = {};
    private tblService: TableService = null;
    private azureStorageAccount: string = '';
    private azureStorageKey: string = '';
    private overrideTableService: TableService = null;
    private testType: new () => T;
    private instanceBatches: AzureDictionary<IAzureBatch> = {};

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

    public saveMany(tableName: string, input: T[]): Promise<AzureBatchResults> {
        return new Promise<AzureBatchResults>((resolve : (val: AzureBatchResults) => void, reject : (val: AzureBatchResults) => void) => {
            let batchId: string = this.newGuid();
            this.createBatch(batchId, tableName, AzureBatchType.instance);
            for (let curObj of input) {
                this.addBatchSave(batchId, curObj, AzureBatchType.instance);
            }
            this.executeBatch(batchId, AzureBatchType.instance).then((res: AzureBatchResults) => {
                resolve(res);
            }).catch((err: AzureBatchResults) => {
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

    public removeMany(tableName: string, input: T[]): Promise<AzureBatchResults> {
        return new Promise<AzureBatchResults>((resolve : (val: AzureBatchResults) => void, reject : (val: AzureBatchResults) => void) => {
            let batchId: string = this.newGuid();
            this.createBatch(batchId, tableName, AzureBatchType.instance);
            for (let curObj of input) {
                this.addBatchRemove(batchId, curObj, AzureBatchType.instance);
            }
            this.executeBatch(batchId, AzureBatchType.instance).then((res: AzureBatchResults) => {
                resolve(res);
            }).catch((err: AzureBatchResults) => {
                reject(err);
            });
        });
    }

    public addBatchRemove(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): AzureResult<any> {
        return this.removeObjBatch(batchName, obj, batchType);
    }    

    public createBatch(batchName: string, tableName: string, batchType: AzureBatchType = AzureBatchType.instance): void {
        switch (batchType) {
            case AzureBatchType.global:
                let newAzureGlobalBatch: AzureBatch = new AzureBatch();
                newAzureGlobalBatch.currentBatch = new TableBatch();
                newAzureGlobalBatch.tblService = this.tblService;
                newAzureGlobalBatch.tableName = tableName;
                AzureStorageManager.globalBatches[batchName] = newAzureGlobalBatch;
                break;
            case AzureBatchType.instance:
                let newAzureInstanceBatch: AzureBatch = new AzureBatch();
                newAzureInstanceBatch.currentBatch = new TableBatch();
                newAzureInstanceBatch.tblService = this.tblService;
                newAzureInstanceBatch.tableName = tableName;
                this.instanceBatches[batchName] = newAzureInstanceBatch;
                break;
            default:
        }
    }

    public executeBatch(batchName: string, batchType: AzureBatchType = AzureBatchType.instance): Promise<AzureBatchResults> {
        return new Promise<AzureBatchResults>((resolve : (val: AzureBatchResults) => void, reject : (val: AzureBatchResults) => void) => {
            let azureBatch: AzureBatch = null;
            switch (batchType) {
                case AzureBatchType.global:
                    let azureGlobalBatch: AzureBatch = AzureStorageManager.globalBatches[batchName];
                    azureBatch = azureGlobalBatch;
                    break;
                case AzureBatchType.instance:
                    let azureInstanceBatch: AzureBatch = this.instanceBatches[batchName];
                    azureBatch = azureInstanceBatch;
                    break;
                default:
            }

            if (azureBatch !== null) {
                azureBatch.totalBatches.push(azureBatch.currentBatch);
                let newTableBatchesCol: TableBatch[] = [];
                for (let curBatch of azureBatch.totalBatches) {
                    newTableBatchesCol.push(curBatch);
                }
                this.executeBatches(newTableBatchesCol, azureBatch.tblService, 
                                    azureBatch.tableName, null).then((res: AzureBatchResults) => {
                    resolve(res);
                });
            } else {
                let nullBatchOrTblServResult: AzureBatchResults = new AzureBatchResults();
                nullBatchOrTblServResult.overallStatus = AzureBatchResultStatus.allError;
                reject(nullBatchOrTblServResult);
            }
        });
    }

    public addBatchSave(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): AzureResult<any> {
        return this.insertOrReplaceObjBatch(batchName, obj, batchType);
    }

    private getCurrentBatch(batchName: string, batchType: AzureBatchType = AzureBatchType.instance): AzureBatch {
        switch (batchType) {
            case AzureBatchType.global:
                let azureGlobalBatch: AzureBatch = AzureStorageManager.globalBatches[batchName];
                if (azureGlobalBatch !== undefined && azureGlobalBatch !== null) {
                    return azureGlobalBatch;
                } else {
                    return null;
                }
            case AzureBatchType.instance:
                let azureInstanceBatch: AzureBatch = this.instanceBatches[batchName];
                if (azureInstanceBatch !== undefined && azureInstanceBatch !== null) {
                    return azureInstanceBatch;
                } else {
                    return null;
                }
            default:
                return null;
        }
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

    private executeBatches(allBatches: TableBatch[], tblService: TableService, tableName: string, 
                           azureResult: AzureBatchResults): Promise<AzureBatchResults> {
        return new Promise<AzureBatchResults>((resolve : (val: AzureBatchResults) => void, reject : (val: AzureBatchResults) => void) => {
            if (tableName !== undefined && tableName !== null && tblService !== undefined 
                && tblService !== null && allBatches !== undefined && allBatches !== null) {

                if (allBatches.length === 0) {
                    let allError: boolean = true;
                    let allSuccess: boolean = true;
                    for (let curBatchRes of azureResult.results) {
                        if (curBatchRes.result.status === AzureResultStatus.error) {
                            allSuccess = false;
                        }
                        if (curBatchRes.result.status === AzureResultStatus.success) {
                            allError = false;
                        }
                    }
                    if (allError) {
                        azureResult.overallStatus = AzureBatchResultStatus.allError;
                    } else if (allSuccess) {
                        azureResult.overallStatus = AzureBatchResultStatus.allSuccess;
                    } else {
                        azureResult.overallStatus = AzureBatchResultStatus.partialSuccess;
                    }
                    resolve(azureResult);
                }

                let currentBatch: TableBatch = allBatches.pop();
                tblService.executeBatch(tableName, currentBatch, (err: any, result: any, response: any) => {
                    let batchResult: AzureResult<any> = new AzureResult<any>();
                    let newAzureBatchResult: AzureBatchResult = new AzureBatchResult();
                    if (!err) {
                        batchResult.status = AzureResultStatus.success;
                        batchResult.message = 'Successfully executed batch';
                        batchResult.data = result;
                    } else {
                        batchResult.error = new Error(err);
                        batchResult.message = err;
                        batchResult.status = AzureResultStatus.error;
                    }
                    newAzureBatchResult.batch = currentBatch;
                    newAzureBatchResult.result = batchResult;
                    let passInAzureResults: AzureBatchResults = null;
                    if (azureResult !== null && azureResult !== undefined) {
                        passInAzureResults = azureResult;
                    } else {
                        passInAzureResults = new AzureBatchResults();
                    }
                    passInAzureResults.results.push(newAzureBatchResult);

                    this.executeBatches(allBatches, tblService, tableName, passInAzureResults).then((res: AzureBatchResults) => {
                        resolve(res);
                    });
                });
            }
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

    private insertOrReplaceObjBatch(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): AzureResult<any> { 
        let result: AzureResult<any> = new AzureResult<any>();
        let batch: AzureBatch = this.getCurrentBatch(batchName, batchType);
        if (batch !== undefined && batch !== null && batch.currentBatch !== undefined && batch.currentBatch !== null) {
            if (batch.partitionName === null) {
                batch.partitionName = obj.partitionKey;
            }
            if (batch.partitionName === obj.partitionKey) {
                let azureObj = this.convertToAzureObj(obj);
                if (batch.currentBatch.size() >= 100) {
                    batch.totalBatches.push(batch.currentBatch);
                    batch.currentBatch = new TableBatch();
                }
                batch.currentBatch.insertOrReplaceEntity(azureObj);

                result.message = 'Successfully added insert/update to batch.';
                result.status = AzureResultStatus.success;
            } else {
                result.error = new Error('Partition key must match.');
                result.message = 'Partition key must match. Matching keys: ' + batch.partitionName + ' and ' + obj.partitionKey;
                result.status = AzureResultStatus.error;
            }            
        } else {
            result.error = new Error('Batch is undefined somehow.');
            result.message = 'Batch is undefined somehow.';
            result.status = AzureResultStatus.error;
        }

        return result;
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

    private removeObjBatch(batchName: string, obj: T, batchType: AzureBatchType = AzureBatchType.instance): AzureResult<any> {
        let result: AzureResult<any> = new AzureResult<any>();
        let batch: AzureBatch = this.getCurrentBatch(batchName, batchType);
        if (batch !== undefined && batch !== null && batch.currentBatch !== undefined && batch.currentBatch !== null) {
            if (batch.partitionName === null) {
                batch.partitionName = obj.partitionKey;
            }
            if (batch.partitionName === obj.partitionKey) {
                let azureObj = this.convertToAzureObjOnlyKeys(obj);
                if (batch.currentBatch.size() >= 100) {
                    batch.totalBatches.push(batch.currentBatch);
                    batch.currentBatch = new TableBatch();
                }
                batch.currentBatch.deleteEntity(azureObj);

                result.message = 'Successfully added remove to batch.';
                result.status = AzureResultStatus.success;
            } else {
                result.error = new Error('Partition key must match.');
                result.message = 'Partition key must match. Matching keys: ' + batch.partitionName + ' and ' + obj.partitionKey;
                result.status = AzureResultStatus.error;
            }
        } else {
            result.error = new Error('Batch is undefined somehow.');
            result.message = 'Batch is undefined somehow.';
            result.status = AzureResultStatus.error;
        }

        return result;
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
