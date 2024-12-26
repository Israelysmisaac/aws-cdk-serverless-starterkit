import { z } from 'zod';
import { connectToDatabase } from '../../shared/database';
import { Course } from './course-type';

const courseSchema = z.object({
  title: z.string().min(1, { message: 'Title is required' }),  // Required field
  description: z.string().min(1, { message: 'Description is required' }),  // Required field
  status: z.boolean(),  // Required field
  tags: z.array(z.string()).optional(),  // Optional field
  startDate: z.date().optional(),  // Optional field
});

export async function CreateCourse(data: Course) {
    data.startDate = new Date(data.startDate);
    validateCourseInput(data);
    const db = await connectToDatabase();
    const course = await db.collection("courses").insertOne(data);
    return course;
}

const validateCourseInput = (data: Course) => {
    try {
      courseSchema.parse(data); // This will throw an error if validation fails
    } catch (e) {
      if (e instanceof z.ZodError) {
        console.error('Validation errors:', e.errors);
        throw new Error(JSON.stringify(e.errors))
      } else {
        console.error('Unknown error', e);
        throw new Error(JSON.stringify(e))
      }
    }
};