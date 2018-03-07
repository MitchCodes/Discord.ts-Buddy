import { AzureStorageManager, IAzureSavable } from '../../src/data/azurestoragemanager.logic';
import * as wins from 'winston';
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

    let testModelManager: AzureStorageManager<CarTest>;

    beforeAll(() => {
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

});
