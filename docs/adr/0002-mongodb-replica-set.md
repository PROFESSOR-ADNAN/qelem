# ADR 0002: MongoDB Single-Node Replica Set for Multi-Document Transactions

## Status
Accepted

## Context
Mongoose and MongoDB serve as the primary durable source of truth. Certain domain actions—such as post creation with client idempotency key reservation, user account deletion with associated graph tear-down, and report status state machines—require atomic multi-document transactions (`client.startSession()` + `session.withTransaction()`). MongoDB standalone instances reject transactions; transactions require a replica set.

## Decision
Configure MongoDB 7.0/8.0 as a single-node replica set (`rs0`) initiated automatically during container startup via `mongod --replSet rs0 --bind_ip_all` and an init script running `rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongodb:27017" }] })`.

## Alternatives
1. *MongoDB Standalone*: Rejected because MongoDB rejects multi-document ACID transactions on standalone nodes.
2. *3-Node Distributed Replica Set*: Rejected because running 3 MongoDB database nodes on a 4-8 GB VPS exhausts memory and disk I/O with zero availability benefit if all three containers reside on the same physical host.

## Consequences
- Positive: Unlocks complete Mongoose ACID multi-document transactions and optional MongoDB Change Streams.
- Negative: Single node does not provide automatic failover; disaster recovery relies on snapshot and oplog backups to object storage.
