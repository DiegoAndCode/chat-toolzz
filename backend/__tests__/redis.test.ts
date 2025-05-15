import Redis from 'ioredis';

describe('Redis Connection', () => {
  let redis: Redis;

  beforeAll(() => {
    redis = new Redis({
      host: 'localhost',
      port: 6379,
    });
  });

  afterAll(async () => {
    await redis.disconnect();
  });

  test('should connect to Redis', async () => {
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
  });

  test('should set and get a value', async () => {
    await redis.set('testKey', 'testValue');
    const value = await redis.get('testKey');
    expect(value).toBe('testValue');
  })
});
