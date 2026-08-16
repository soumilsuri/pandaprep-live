import type { TestProject } from 'vitest/node';
import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const overrideUri = process.env.TEST_MONGODB_URI;

  if (overrideUri) {
    project.provide('mongoUri', overrideUri);
    return async () => {};
  }

  const mongod = await MongoMemoryServer.create();
  project.provide('mongoUri', mongod.getUri('pandaprep-test'));

  return async () => {
    await mongod.stop();
  };
}