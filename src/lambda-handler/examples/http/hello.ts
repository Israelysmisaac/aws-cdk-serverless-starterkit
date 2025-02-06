
import { Handler } from 'aws-lambda';
import { sayHello } from '../../../services/examples/hello';

export const handler: Handler = async (event, context) => {
    console.log('EVENT: \n' + JSON.stringify(event, null, 2));
    const result = await sayHello(event.body, event.headers, context);
    return { message: result};
};