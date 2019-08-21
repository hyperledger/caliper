var express = require("express");
var api = express.Router();

api.get("/", function(req, res) {
    res.end("APIv2 TODO");
});

module.exports = api;