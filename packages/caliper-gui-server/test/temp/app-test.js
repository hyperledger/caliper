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

app.get("/random/:min/:max", (req, res) => {
    var min = parseInt(req.params.min);
    var max = parseInt(req.params.max);

    if (isNaN(min) || isNaN(max)) {
        res.status(400);
        res.json({
            error: "Bad request"
        });
        return;
    }

    var result = Math.round((Math.random() * (max - min)) + min);
    res.json({
        result: result
    });
});

app.listen(3000, () => {
    console.log("App started on port 3000");
});