
import { Handler } from 'aws-lambda';

export const handler: Handler = async (event, context, callback: any) => {
    let data;
    try {
        console.log("auth log")
        data = await authenticate(event);
    } catch (err) {
        console.log('UNAUTHORISED', err);
        return context.fail('Unauthorized');
    }

    console.log('AUTHORISED', data);
    return data;
};


const getPolicyDocument = (effect: any, resource: any) => {
    return {
        Version: '2012-10-17',
        Statement: [{
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: resource,
        }]
    };
}

const getToken = (event: any) => {
    if (!event.type || event.type !== 'REQUEST') {
        throw new Error('Expected "event.type" parameter to have value "REQUEST"');
    }

    const tokenString = event.queryStringParameters?.key;
    if (!tokenString) {
        throw new Error('Expected "event.queryStringParameters.key" parameter to be set');
    }

    return tokenString;
}

const authenticate = (event: any) => {
    console.log(event);
    const token = getToken(event);

    return {
        principalId: "test",
        policyDocument: getPolicyDocument('Allow', '*'),
        context: {scope: "my-socket"}
    }
}