#!/bin/bash
set -e

echo "Initializing single-node replica set rs0..."
mongosh --eval '
try {
  rs.status();
  console.log("Replica set rs0 already initiated.");
} catch (err) {
  console.log("Initiating replica set rs0...");
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongodb:27017" }]
  });
}
'
