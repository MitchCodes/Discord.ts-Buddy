import { LoggerInstance } from 'winston';
import {Provider} from 'nconf';

export class MainController {

    private logger: LoggerInstance;

    public startProgram(winstonLogger: LoggerInstance, conf: Provider) {
        this.logger = winstonLogger;

        let botTokens: string[] = conf.get('botTokens');
        if (botTokens.length === 0) {
            this.logger.error('No bot tokens are set for this program. Shutting down bot.');
            
            return;
        }
        
        this.logger.info(botTokens[0]);
    }
}
