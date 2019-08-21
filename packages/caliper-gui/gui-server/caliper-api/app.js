var express = require("express");
const PORT = 3001;
var apiV1 = require("./src/api/api1.js");
// var apiV2 = require("./src/api/api2.js");
var app = express();
const cors = require("cors");

app.use(cors());
// For data posting
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());


app.use("/v1", apiV1);
// app.use("/v2", apiV2);

app.listen(PORT, function() {
    console.log(`Caliper-API started on port ${PORT}`);
});