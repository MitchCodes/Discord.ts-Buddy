// tslint:disable:no-console no-require-imports no-var-requires
import { AzureStorageManager, IAzureSavable, AzureResult, IAzureResult, 
         AzureResultStatus, AzureBatchResult, AzureBatchResults, 
         AzureBatchResultStatus, AzureCache, AzureIdentifier } from '../../src/data/azurestoragemanager.logic';
import * as winston from 'winston';
import * as nconf from 'nconf';
import { ModelComparer } from '../../src/logic/helpers/modelcompare.helper';
import { TableQuery } from 'azure-storage';
import * as moment from 'moment';
jest.mock('../../src/data/azurestoragemanager.logic');

export class CarTest implements IAzureSavable {
    public partitionKey: string;
    public rowKey: string;
    public classVersion: number = 2;
    public color: string;
    public make: string;
    public model: string;
    public year: number;
    public dateMade: Date;
    public turboType: string;
    public tireName: string;
    public engine: Object;
    public isOn: boolean;
    public turnOn() {
        this.isOn = true;
    }

    public handleVersionChange(inputObject: Object, inputVersion: number, latestVersion: number): boolean {
        if (inputVersion === 1 && latestVersion === 2) {
            // tslint:disable-next-line:no-string-literal
            inputObject['tireName'] = 'New Tire';

            return true;
        }

        return false;
    }
}

describe('azure-storage-manager-tests', () => {
    let logger: winston.LoggerInstance;
    let testModel: CarTest;
    let convObject: Object = null;
    let convertedTestModel: CarTest;
    let testModelManager: any;

    let storageAcct: string;
    let storageKey: string;
    let storageTable: string;

    beforeAll(() => {
        nconf.file({ file: './config.common.json' });
        nconf.defaults({
            test: {
                azure: {
                    testAccount: '',
                    testAccountKey: '',
                    testTable: 'unittests',
                },
            },
        });

        storageAcct = nconf.get('test:azure:testAccount');
        storageKey = nconf.get('test:azure:testAccountKey');
        storageTable = nconf.get('test:azure:testTable');

        testModel = new CarTest();
        testModel.partitionKey = 'testPartition';
        testModel.rowKey = 'row 1';
        testModel.color = 'blue';
        testModel.make = 'Honda';
        testModel.model = 'Civic';
        testModel.year = 2003;
        testModel.dateMade = new Date();
        testModel.turboType = undefined; // test undefined scenario
        testModel.engine = { isPowerful: true };
        testModel.classVersion = 1;

        logger = new winston.Logger({
            level: 'debug',
            transports: [
              new (winston.transports.Console)(),
            ],
          });

        logger.info('Account: ' + storageAcct);

        testModelManager = new AzureStorageManager<CarTest>(CarTest);
        convObject = testModelManager.convertToAzureObj(testModel);
        convertedTestModel = testModelManager.convertFromObjToType(testModelManager.convertFromAzureObjToObject(convObject));

        AzureCache.prototype.setItem = jest.fn(AzureCache.prototype.setItem);
    });

    // afterAll(() => {

    // });

    test('can convert to an azure object', () => {
        expect(convObject !== null).toBeTruthy();
        // tslint:disable-next-line:no-string-literal
        expect(convObject['PartitionKey'] !== null).toBeTruthy();
    });

    test('can convert from an azure object', () => {
        expect(convertedTestModel !== null).toBeTruthy();
        expect(convertedTestModel.partitionKey !== null).toBeTruthy();
    });

    test('original and converted from are same', () => {
        let modelComparer: ModelComparer<CarTest> = new ModelComparer<CarTest>();
        let areSame = modelComparer.propertiesAreEqualToFirst(testModel, convertedTestModel, true);
        expect(areSame).toBeTruthy();
    });

    test('can use functions after type conversion', () => {
        expect(convertedTestModel.isOn).not.toBeTruthy();
        convertedTestModel.turnOn();
        expect(convertedTestModel.isOn).toBeTruthy();
    });

    test('can upgrade correctly', () => {
        let convNormObj: Object = testModelManager.convertFromAzureObjToObject(convObject);
        let preUpgradedObj: CarTest = testModelManager.convertFromObjToType(convNormObj);
        testModelManager.updateModel(convNormObj);
        let upgradedObj: CarTest = testModelManager.convertFromObjToType(convNormObj);
        expect(preUpgradedObj.classVersion === 1 && preUpgradedObj.tireName !== 'New Tire').toBeTruthy();
        expect(upgradedObj.classVersion === 2 && upgradedObj.tireName === 'New Tire').toBeTruthy();
    });

    test('can create test table', (done: any) => {
        let manager: AzureStorageManager<CarTest> = new AzureStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        manager.initializeConnection();
        manager.createTableIfNotExists(storageTable).then((success: IAzureResult) => {
            expect(success !== null).toBeTruthy();
            done();
        }).catch((err: IAzureResult) => {
            expect(false).toBeTruthy();
            done();
        });
    });
    
    test('can insert record, retrieve, query and remove', (done: any) => {
        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cars';
        newCar.rowKey = 'car1';
        newCar.color = 'Blue';
        newCar.make = 'Honda';
        newCar.model = 'Civic';
        newCar.year = 2003;
        newCar.dateMade = new Date();
        newCar.turboType = undefined; // test undefined scenario
        newCar.engine = { isPowerful: true };
        newCar.classVersion = 1;
        newCar.isOn = false;

        let manager: AzureStorageManager<CarTest> = new AzureStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        manager.initializeConnection();

        manager.save(storageTable, newCar).then((success: IAzureResult) => {
            expect(success !== null).toBeTruthy();
            manager.getByPartitionAndRowKey(storageTable, 'cars', 'car1').then((dataSuccess: AzureResult<CarTest>) => {
                expect(dataSuccess.data.length > 0).toBeTruthy();
                if (dataSuccess.data.length > 0) {
                    expect(dataSuccess.data[0].make === 'Honda').toBeTruthy();
                }
                expect(dataSuccess.data[0].isOn === false).toBeTruthy();
                dataSuccess.data[0].turnOn();
                expect(dataSuccess.data[0].isOn === true).toBeTruthy();
                manager.getByPartitionKey(storageTable, 'cars').then((dataPartitionSuccess: AzureResult<CarTest>) => {
                    expect(dataPartitionSuccess.data.length > 0).toBeTruthy();
                    let query: TableQuery = new TableQuery().where('make eq ?', 'Honda');
                    manager.getByQuery(storageTable, query).then((dataQuerySuccess: AzureResult<CarTest>) => {
                        expect(dataQuerySuccess.data.length > 0).toBeTruthy();
                        manager.remove(storageTable, newCar).then((dataRemoveSuccess: AzureResult<CarTest>) => {
                            expect(dataRemoveSuccess !== null).toBeTruthy();
                            done();
                        }).catch((dataRemoveErr: AzureResult<CarTest>) => {
                            console.error(dataRemoveErr.error);
                            expect(dataRemoveErr.status !== AzureResultStatus.error).toBeTruthy();
                            done();
                        });
                    }).catch((dataQueryErr: AzureResult<CarTest>) => {
                        console.error(dataQueryErr.error);
                        expect(false).toBeTruthy();
                        done();
                    });
                }).catch((dataErrPartKey: AzureResult<CarTest>) => {
                    console.error(dataErrPartKey.error);
                    expect(false).toBeTruthy();
                    done();
                });
            }).catch((dataErr: AzureResult<CarTest>) => {
                console.error(dataErr.error);
                expect(false).toBeTruthy();
                done();
            });
        }).catch((err: IAzureResult) => {
            console.error(err.error);
            expect(false).toBeTruthy();
            done();
        });
        
    });

    test('remove all, batch insert, batch remove', (done: any) => {
        let lotsaCars: CarTest[] = generateLotsOfCars('batchTest1', 105);
        console.log('Cars generated: ' + lotsaCars.length);

        let query: TableQuery = new TableQuery().where('make eq ?', 'Honda').and('PartitionKey eq ?', 'batchTest1');
        let manager: AzureStorageManager<CarTest> = new AzureStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        //let managerAny: any = <any>manager;
        manager.initializeConnection();
        manager.removeByQuery(storageTable, query).then((removeQuerySuccess: AzureBatchResults) => {
            expect(removeQuerySuccess.overallStatus === AzureBatchResultStatus.allSuccess).toBeTruthy();
            manager.saveMany(storageTable, lotsaCars).then((success: AzureBatchResults) => {
                expect(success.overallStatus === AzureBatchResultStatus.allSuccess).toBeTruthy();
                expect(success.results.length === 3).toBeTruthy();
                if (success.overallStatus === AzureBatchResultStatus.allSuccess) {
                    manager.getByQuery(storageTable, query).then((dataQuerySuccess: AzureResult<CarTest>) => {
                        expect(dataQuerySuccess.data.length === 105).toBeTruthy();
                        manager.removeMany(storageTable, lotsaCars).then((delSuccess: AzureBatchResults) => {
                            expect(delSuccess.overallStatus === AzureBatchResultStatus.allSuccess).toBeTruthy();
                            done();
                        }).catch((delErr: AzureBatchResults) => {
                            expect(false).toBeTruthy();  
                            done();
                        });
                    }).catch((dataQueryErr: AzureResult<CarTest>) => {
                        expect(false).toBeTruthy();
                        done();
                    });
                }
            }).catch((err: AzureBatchResults) => {
                expect(false).toBeTruthy();  
                done();
            });
        }).catch((removeQueryErr: AzureBatchResults) => {
            expect(false).toBeTruthy();
            done();
        });
    });

    test('caching class works', () => {
        let comparer: ModelComparer<CarTest> = new ModelComparer<CarTest>();
        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cachecars1';
        newCar.rowKey = 'car1';
        newCar.color = 'Blue';
        newCar.make = 'Honda';
        newCar.model = 'Civic';
        newCar.year = 2003;
        newCar.dateMade = new Date();
        newCar.turboType = undefined; // test undefined scenario
        newCar.engine = { isPowerful: true };
        newCar.classVersion = 1;
        newCar.isOn = false;

        let newCarId: AzureIdentifier = AzureIdentifier.fromObj(newCar);
        let tempTableName: string = 'testing';

        let azureCache: AzureCache<CarTest> = new AzureCache<CarTest>();
        expect(azureCache.getItem(tempTableName, newCarId)).toBeNull();
        expect(azureCache.getItem(tempTableName, newCarId)).toBeNull();

        azureCache.setItem(tempTableName, newCar, moment.duration(5, 'minutes'));

        let cachedCar: CarTest = azureCache.getItem(tempTableName, newCarId);
        expect(cachedCar).not.toBeNull();
        expect(comparer.propertiesAreEqualToFirst(newCar, cachedCar)).toBeTruthy();

        azureCache.invalidateCacheItem(tempTableName, newCarId);
        expect(azureCache.getItem(tempTableName, newCarId)).toBeNull();        

        let newCar2: CarTest = new CarTest();
        newCar2.partitionKey = 'cachecars1';
        newCar2.rowKey = 'car1';
        newCar2.color = 'Blue';
        newCar2.make = 'Honda';
        newCar2.model = 'Civic';
        newCar2.year = 2003;
        newCar2.dateMade = new Date();
        newCar2.turboType = undefined; // test undefined scenario
        newCar2.engine = { isPowerful: true };
        newCar2.classVersion = 1;
        newCar2.isOn = false;
        
        let carArray: CarTest[] = [];
        carArray.push(newCar2);

        let testQuery: TableQuery = new TableQuery().where('make eq ?', '>?`!Honda');
        expect(azureCache.getItemsByQuery(tempTableName, testQuery)).toBeNull();
        expect(azureCache.getItemsByQuery(tempTableName, testQuery)).toBeNull();

        azureCache.setItemsByQuery(tempTableName, carArray, testQuery, moment.duration(3, 'minutes'));

        let cachedCarArray: CarTest[] = azureCache.getItemsByQuery(tempTableName, testQuery);
        expect(cachedCarArray).not.toBeNull();
        expect(cachedCarArray).toHaveLength(1);

        let cachedCarArrayCar: CarTest = azureCache.getItem(tempTableName, AzureIdentifier.fromObj(newCar2));
        expect(cachedCarArrayCar).not.toBeNull();
        expect(comparer.propertiesAreEqualToFirst(cachedCarArrayCar, newCar2)).toBeTruthy();
        cachedCarArrayCar.color = 'pink';
        expect(comparer.propertiesAreEqualToFirst(cachedCarArrayCar, newCar2)).toBeTruthy();
        expect(newCar2.color === 'pink').toBeTruthy();

        azureCache.resetCache(tempTableName);

        expect(azureCache.getItemsByQuery(tempTableName, testQuery)).toBeNull();
    });

    // tslint:disable-next-line:mocha-unneeded-done
    test('test caching with data works', (done: any) => {
        let newCar: CarTest = new CarTest();
        newCar.partitionKey = 'cachecars2';
        newCar.rowKey = 'car1';
        newCar.color = 'Blue';
        newCar.make = 'Honda';
        newCar.model = 'Civic';
        newCar.year = 2003;
        newCar.dateMade = new Date();
        newCar.turboType = undefined; // test undefined scenario
        newCar.engine = { isPowerful: true };
        newCar.isOn = false;

        let newCar2: CarTest = new CarTest();
        newCar2.partitionKey = 'cachecars2';
        newCar2.rowKey = 'car2';
        newCar2.color = 'Blue';
        newCar2.make = 'Honda';
        newCar2.model = 'Something';
        newCar2.year = 2008;
        newCar2.dateMade = new Date();
        newCar2.turboType = undefined; // test undefined scenario
        newCar2.engine = { isPowerful: true };
        newCar2.isOn = false;

        let cars: CarTest[] = [];
        cars.push(newCar);
        cars.push(newCar2);

        let manager: AzureStorageManager<CarTest> = new AzureStorageManager<CarTest>(CarTest, storageAcct, storageKey);
        let managerAny: any = <any>manager;
        manager.initializeConnection();

        let testQuery: TableQuery = new TableQuery().where('make eq ?', 'Honda');

        manager.saveMany(storageTable, cars).then((saveRes: AzureBatchResults) => {
            expect(saveRes.overallStatus === AzureBatchResultStatus.allSuccess).toBeTruthy();

            return manager.getByPartitionAndRowKey(storageTable, newCar.partitionKey, newCar.rowKey, true);
        }).then((queryRes: AzureResult<CarTest>) => {
            expect(queryRes.status === AzureResultStatus.success).toBeTruthy();
            expect(queryRes.data.length > 0).toBeTruthy();
            expect(managerAny.cache).not.toBeUndefined();
            expect(managerAny.cache).not.toBeNull();
            expect(AzureCache.prototype.setItem).toHaveBeenCalled();

            return manager.getByPartitionAndRowKey(storageTable, newCar.partitionKey, newCar.rowKey, true);
        }).then((queryRes: AzureResult<CarTest>) => {
            expect(queryRes.message === 'Got data from cache.').toBeTruthy();
            let azureCache: AzureCache<CarTest> = managerAny.cache;
            let car: CarTest = azureCache.getItem(storageTable, AzureIdentifier.fromObj(newCar));
            expect(car).not.toBeNull();
            expect(car).not.toBeUndefined();
            
            let comparer: ModelComparer<CarTest> = new ModelComparer<CarTest>();

            expect(comparer.propertiesAreEqualToFirst(newCar, car, true)).toBeTruthy();

            return manager.getByPartitionKey(storageTable, car.partitionKey, true);
        }).then((queryPRes: AzureResult<CarTest>) => {
            expect(queryPRes.message === 'Got data from cache.').not.toBeTruthy();
            expect(queryPRes.status === AzureResultStatus.success).toBeTruthy();
            expect(queryPRes.data.length > 1).toBeTruthy();

            return manager.getByPartitionKey(storageTable, queryPRes.data[0].partitionKey, true);
        }).then((queryPRes: AzureResult<CarTest>) => {
            expect(queryPRes.message === 'Got data from cache.').toBeTruthy();
            expect(queryPRes.status === AzureResultStatus.success).toBeTruthy();
            expect(queryPRes.data.length > 1).toBeTruthy();

            done();
        }).catch((err: any) => {
            console.error(err);
            expect(false).toBeTruthy();
            done();
        });
    });

    let generateLotsOfCars = (partitionName: string, amount: number): CarTest[] => {
        let returnCars: CarTest[] = [];
        // tslint:disable-next-line:no-increment-decrement
        for (let i = 0; i < amount; i++) {
            let newCar: CarTest = new CarTest();
            newCar.partitionKey = partitionName;
            newCar.rowKey = 'car' + i;
            newCar.color = 'Some Color';
            newCar.make = 'Honda';
            newCar.model = 'Civic';
            newCar.year = 2003;
            newCar.dateMade = new Date();
            newCar.turboType = undefined; // test undefined scenario
            newCar.engine = { isPowerful: true };
            newCar.classVersion = 1;
            newCar.isOn = false;
            returnCars.push(newCar);
        }
        
        return returnCars;
    };
});
