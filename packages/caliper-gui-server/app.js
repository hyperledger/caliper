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
/*
 * Author:               Jason You
 * Last modified date:   Sep 1 2019
 *
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
/*jshint esversion: 6 */

let express = require('express');
const PORT = 3001;
let apiV1 = require('./src/api/api1.js');
// var apiV2 = require("./src/api/api2.js");
let app = express();
const cors = require('cors');

app.use(cors());
// For data posting
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());


app.use('/v1', apiV1);
// app.use("/v2", apiV2);

app.listen(PORT, function() {
    console.log(`Caliper-API started on port ${PORT}`);
});
