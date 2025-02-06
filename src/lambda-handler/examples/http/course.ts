
import { Handler } from 'aws-lambda';
import { courseList } from '../../../services/course/list-course';

export const handler: Handler = async (event, context) => {
    console.log('EVENT: \n' + JSON.stringify(event, null, 2));
    const list = await courseList();
    console.log("list", list);
    return context.logStreamName;
};