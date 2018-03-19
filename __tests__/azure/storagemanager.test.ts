// tslint:disable:no-console no-require-imports no-var-requires
import { AzureStorageManager, IAzureSavable, AzureResult, IAzureResult, 
         AzureResultStatus, AzureBatchResult, AzureBatchResults, AzureBatchResultStatus } from '../../src/data/azurestoragemanager.logic';
import * as winston from 'winston';
import * as nconf from 'nconf';
import { ModelComparer } from '../../src/logic/helpers/modelcompare.helper';
import { TableQuery } from 'azure-storage';

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
                            expect(dataRemoveErr.status !== AzureResultStatus.error).toBeTruthy();
                            done();
                        });
                    }).catch((dataQueryErr: AzureResult<CarTest>) => {
                        expect(false).toBeTruthy();
                        done();
                    });
                }).catch((dataErrPartKey: AzureResult<CarTest>) => {
                    expect(false).toBeTruthy();
                    done();
                });
            }).catch((dataErr: AzureResult<CarTest>) => {
                expect(false).toBeTruthy();
                done();
            });
        }).catch((err: IAzureResult) => {
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
