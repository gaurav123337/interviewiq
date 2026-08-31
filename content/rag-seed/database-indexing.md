# Database Indexing

An index is a secondary data structure that lets the database find rows without scanning the whole table. It trades write speed and storage for read speed: every index must be updated on every insert, update, and delete, so indexes are not free.

## B-tree indexes

The default index in most relational databases is a B-tree (technically a B+ tree). It keeps keys sorted and balanced so lookups, range scans, and ordered reads all run in logarithmic time. Because the keys are sorted, a B-tree serves equality queries (`WHERE id = 5`), range queries (`WHERE age > 30`), prefix matches, and `ORDER BY` on the indexed column.

## Composite and covering indexes

A composite index covers multiple columns in a defined order. It can serve queries that filter on a leftmost prefix of those columns — an index on `(field_id, status)` helps `WHERE field_id = ?` and `WHERE field_id = ? AND status = ?`, but not `WHERE status = ?` alone. A covering index includes every column a query needs, so the database answers entirely from the index without touching the table — an index-only scan.

## When not to index

Indexes hurt when a column has low cardinality (few distinct values, like a boolean), because the index barely narrows the search. They also slow down write-heavy tables, and each one consumes storage and memory. The right number of indexes is the smallest set that serves your actual query patterns.

## Reading the plan

Use `EXPLAIN` (or `EXPLAIN ANALYZE`) to see whether a query uses an index or falls back to a sequential scan. A sequential scan on a large table in a hot query path is the classic signal that an index is missing.
