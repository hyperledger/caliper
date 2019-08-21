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
import { 
  Line,
  Bar,
} from "react-chartjs-2";

// reactstrap components
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  Row,
  Col
} from "reactstrap";

const DashboardVisualization = function(props) {
    return(
      <div id="tx-throughput-block">
        <Row>
          <Col md='12'>
          <Card
          className='text-center text-primary'
          style={{ paddingTop: "25px" }}
          >
          <h2>{props.icon} {props.name}</h2>
          </Card>
          </Col>
        </Row>
        <Row>
          <Col md='12'>
          <Card>
            <CardHeader>
              <CardTitle>{props.name} Since Running</CardTitle>
              <p className='card-category'>Description</p>
            </CardHeader>
            <CardBody>
              <Line
                data={props.lineData}
                options={props.lineOptions}
                height={props.lineHeight}
                />
            </CardBody>
            <CardFooter>
              <hr />
              <div className='stats'>
                <i className="fa fa-anchor" /> Anchor
              </div>
            </CardFooter>
          </Card>
          </Col>
        </Row>
        <Row>
          <Col md='12'>
          <Card>
            <CardHeader>
              <CardTitle>
                Monthly Latency Tx. Counting (Slow, Normal, Fast)
              </CardTitle>
              <p className='card-category'>
                Stacked bar chart with slow as red, normal as yellow, and fast as green.
              </p>
            </CardHeader>
            <CardBody>
              <Bar
                data={props.barData}
                options={props.barOptions}
                height={props.barHeight}
                />
            </CardBody>
            <CardFooter>
              <hr />
              <div className='stats'>
                <i className="fa fa-anchor" /> Anchor
              </div>
            </CardFooter>
          </Card>
          </Col>
        </Row>
      </div>
    );
}

export default DashboardVisualization;