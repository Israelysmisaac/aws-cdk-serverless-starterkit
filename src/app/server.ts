// Import the 'express' module along with 'Request' and 'Response' types from express
import express, { Request, Response } from 'express';
import { courseList } from '../services/course/list-course';
import { connectToDatabase } from '../shared/database';
import { CreateCourse } from '../services/course/create-course';

async ()=>{
  await connectToDatabase()
}

// Create an Express application
const app = express();
app.use(express.json())
// Specify the port number for the server
const port: number = 3000;

// Define a route for the root path ('/')
app.get('/', (req: Request, res: Response) => {
  // Send a response to the client
  res.send('Hello, TypeScript + Node.js + Express!');
});

app.get('/courses', (req: Request, res: Response) => {
  let result = courseList()
  // Send a response to the client
  res.send(result);
});

app.post('/course', async (req: Request, res: Response) => {
  try {
    let result = await CreateCourse(req.body);
    res.send(result);
  } catch (error) {
    res.status(500).send('Something broke!: '+ error)
  }
  
});

// Start the server and listen on the specified port
app.listen(port, () => {
  // Log a message when the server is successfully running
  console.log(`Server is running on http://localhost:${port}`);
});