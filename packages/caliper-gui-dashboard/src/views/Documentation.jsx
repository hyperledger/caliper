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
/*!

=========================================================
* Hyperledger Caliper GUI
=========================================================

* Author: Jason You
* GitHub: 
* Licensed under the Apache 2.0 - https://www.apache.org/licenses/LICENSE-2.0

Copyright (c) 2019 Jason You

*/

import React from "react";

// reactstrap components
import {
  Card,
  CardHeader,
  CardBody,
  Row,
  Col
} from "reactstrap";

class Documentation extends React.Component {
  render() {
    return (
      <>
        <div className="content">
          <Row>
            <Col md="12">
            <Card>
              <CardHeader>
                <h3 className="title text-primary">Caliper GUI Setup</h3>
                <p className="category">
                  Step-by-step guide to setup the test on Caliper GUI
                </p>
              </CardHeader>
              <CardBody>
                <div className="typography-line">
                  <p>
                    <span>Step 1 <b className="text-warning">[Start MongoDB]</b></span>
                    <b>Installing and start</b> the <b>MongoDB</b> server in your local: <i>$ mongod --dbpath YOUR_PATH</i>. Here YOUR_PATH is the path that you want to store all the DB data and files, and you can just ues <i>$ mongod</i> to use the default path in your local machine. Make sure the port is the default port: <i>http://localhost:27017</i>.
                  </p>
                </div>
                <div className="typography-line">
                  <p>
                    <span>Step 2 <b className="text-warning">[Start GUI Server]</b></span>
                    Make sure that the `gui-server` is started on port: <i>http://localhost:3001</i>
                  </p>
                </div>
                <div className="typography-line">
                  <p>
                    <span>Step 3 <b className="text-warning">[Workspace Configuration]</b></span>
                    Go to the <b>Configuration</b> tab located in the buttton of sidebar to setup the network configuration <b>workspace</b>.
                  </p>
                </div>
                <div className="typography-line">
                  <p>
                    <span>Step 4 <b className="text-warning">[Network Configuration]</b></span>
                    In the same Configuration tab, file and upload the <b>network configuration</b> <i>.yaml</i> file.
                  </p>
                </div>
                <div className="typography-line">
                  <p>
                    <span>Step 5 <b className="text-warning">[Test Configuration]</b></span>
                    Edit or import the <b>benchmark test configuration</b> file for Caliper to test the specified Hyperledger Blockchain, and then upload it.
                  </p>
                </div>
                <div className="typography-line">
                  <p>
                    <span>Step 6 <b className="text-warning">[Start Test]</b></span>
                    <b>Starting the test</b> by clicking on the "Start Test" button in the <b>Configuration</b> tabon or the top left corner (TODO) , and wait it to finish. When the test starts, the start test button will be disabled and need to wait until the test is finished. An alert will popout and show that the test is finished (TODO).
                  </p>
                </div>
                <div className="typography-line">
                  <p>
                    <span>Step 7 <b className="text-warning">[Dashboard Result]</b></span>
                    <b>Visualization</b> of the Blockchain performance benchmark with be available in "Dashboard" after the test finished.
                  </p>
                </div>
              </CardBody>
            </Card>
            </Col>
          </Row>
          <Row>
            <Col md="12">
            <Card>
              <CardHeader>
                <h3 className="title text-primary">Caliper Benchmark Data Output</h3>
                <p className="category">
                  You can download the data history or provide them for visualiation.
                </p>
              </CardHeader>
              <CardBody>
                <div className="typography-line">
                  <h3>
                    <span>Test Ouput Data JSON Template</span>
                    Provide proper data structure when the Cliper-cli is stablized...
                  </h3>
                </div>
              </CardBody>
            </Card>
            </Col>
          </Row>
        </div>
      </>
    );
  }
}

export default Documentation;
