import { IRED } from '../../nodes/_common';

interface IMongoMemoryConfig {
  name?: string;
  url: string;
  db: string;
  defaultCollection?: string;
}

function register(RED: IRED): void {
  function MongoMemoryConfig(this: unknown, config: IMongoMemoryConfig): void {
    RED.nodes.createNode(this, config);
  }

  RED.nodes.registerType<IMongoMemoryConfig>('mongo-memory', MongoMemoryConfig);
}

export default register;
