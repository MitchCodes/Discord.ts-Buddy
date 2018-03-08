import { AzureStorageManager, IAzureSavable, AzureResult, IAzureResult, AzureResultStatus } from '../../src/data/azurestoragemanager.logic';
import * as wins from 'winston';
import * as nconf from 'nconf';
import { ModelComparer } from '../../src/logic/helpers/modelcompare.helper';

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
    let logger: wins.LoggerInstance;
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

        logger = new wins.Logger({
            level: 'debug',
            transports: [
              new (wins.transports.Console)(),
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
        logger.info('Converted TO Azure Storage Obj');
        logger.info(JSON.stringify(convObject));
        expect(convObject !== null).toBeTruthy();
        // tslint:disable-next-line:no-string-literal
        expect(convObject['PartitionKey'] !== null).toBeTruthy();
    });

    test('can convert from an azure object', () => {
        logger.info('--------------------------------------');
        logger.info('Converted FROM Azure Storage Obj');
        logger.info(JSON.stringify(convertedTestModel));
        expect(convertedTestModel !== null).toBeTruthy();
        expect(convertedTestModel.partitionKey !== null).toBeTruthy();
    });

    test('original and converted from are same', () => {
        logger.info('--------------------------------------');
        logger.info('Original vs converted from');
        logger.info(JSON.stringify(testModel));
        logger.info(JSON.stringify(convertedTestModel));
        let modelComparer: ModelComparer<CarTest> = new ModelComparer<CarTest>();
        let areSame = modelComparer.propertiesAreEqualToFirst(testModel, convertedTestModel, true);
        // tslint:disable-next-line:triple-equals
        expect(areSame).toBeTruthy();
    });

    test('can use functions', () => {
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
            expect(err.status !== AzureResultStatus.error).toBeTruthy();
            done();
        });
    });
    
    test('can insert record and retrieve', (done: any) => {
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
                // tslint:disable-next-line:no-console
                console.log(dataSuccess.data);
                expect(dataSuccess.data.length > 0).toBeTruthy();
                if (dataSuccess.data.length > 0) {
                    expect(dataSuccess.data[0].make === 'Honda').toBeTruthy();
                }
                expect(dataSuccess.data[0].isOn === false).toBeTruthy();
                dataSuccess.data[0].turnOn();
                expect(dataSuccess.data[0].isOn === true).toBeTruthy();
                done();
            }).catch((dataErr: AzureResult<CarTest>) => {
                expect(dataErr.status !== AzureResultStatus.error).toBeTruthy();
                done();
            });
        }).catch((err: IAzureResult) => {
            expect(err.status !== AzureResultStatus.error).toBeTruthy();
            done();
        });
        
    });
});
