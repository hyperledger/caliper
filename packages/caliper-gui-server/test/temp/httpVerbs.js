/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var express = require("express");
var app = express();

app.get("/", function(req, res) {
    res.send("you just sent a GET request, friend");
});

app.post("/", function(req, res) {
    res.send("you just sent a POST request, friend");
});

app.put("/", function(req, res) {
    res.send("I don't see a lot of PUT requests anymore");
});

app.delete("/", function(req, res) {
    res.send("oh my, a DELETE??");
});

app.listen(3001, function() {
    console.log("App is listening on port 3001");
});