import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME;

if (!DB_NAME) throw new Error('Please define DB_NAME in .env.local');

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Extend NodeJS global to include our typed clientPromise
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  // Use global variable in dev to avoid multiple connections
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // Production: just create a new client
  client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

export async function connectToDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export { clientPromise };
