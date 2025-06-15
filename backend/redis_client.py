import os
import redis.asyncio as redis
from urllib.parse import quote as safequote

redis_host = safequote(os.environ.get('REDIS_HOST', 'localhost'))
redis_client = redis.Redis(host=redis_host, port=6379, db=0)

async def add_key_value_redis(key, value, expire_secs=None):
    if expire_secs:
        await redis_client.set(key, value, ex=expire_secs)
    else:
        await redis_client.set(key, value)

async def get_value_redis(key):
    return await redis_client.get(key)

async def delete_key_redis(key):
    await redis_client.delete(key)
