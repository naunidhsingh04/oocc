import pytest
from app.cache import InMemoryCache, cache_key

pytestmark = pytest.mark.anyio


def test_cache_key_is_stable_and_source_sensitive() -> None:
    a = cache_key(source="x = 1", stdin="")
    b = cache_key(source="x = 1", stdin="")
    c = cache_key(source="x = 2", stdin="")
    assert a == b
    assert a != c


def test_cache_key_is_stdin_sensitive() -> None:
    a = cache_key(source="x = input()", stdin="1")
    b = cache_key(source="x = input()", stdin="2")
    assert a != b


async def test_in_memory_cache_round_trips() -> None:
    cache = InMemoryCache()
    key = cache_key(source="x", stdin="")
    assert await cache.get(key) is None

    await cache.set(key, '{"a": 1}')
    assert await cache.get(key) == '{"a": 1}'
    assert len(cache) == 1
