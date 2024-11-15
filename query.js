var duckdb = require('duckdb');
var db = new duckdb.Database(':memory:'); // or a file name for a persistent DB
console.log("hello");
