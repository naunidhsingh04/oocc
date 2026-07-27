def lookup(id, records):
    for r in records:
        if r["id"] == id:
            return r
    return None


print(lookup(2, [{"id": 1}, {"id": 2}]))
