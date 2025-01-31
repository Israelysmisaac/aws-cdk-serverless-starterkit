import { Db, MongoClient } from 'mongodb'

const MONGODB_URI = "mongodb+srv://gfd:gd@cluster0.3uuvs.mongodb.net/test-demo?retryWrites=true&w=majority";
// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
export let cachedDb:Db|null = null;

export function connectToDatabase(): Promise<Db> {
    return new Promise(async (resolve, reject)=> {
        if (cachedDb) {
            resolve(cachedDb);
          }
          try {
              // Connect to our MongoDB database hosted on MongoDB Atlas
              const client = await MongoClient.connect(MONGODB_URI);
              // Specify which database we want to use
              const db = await client.db("test-demo");
              cachedDb = db;
              resolve(db);
          } catch (error) {
              console.log("DB connection Failed", error);
              reject(error);
          }
    })
    
}