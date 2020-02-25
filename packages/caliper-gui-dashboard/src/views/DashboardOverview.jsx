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
    Row,
    Col,
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    CardFooter,
} from "reactstrap";

import {
  Line,
} from "react-chartjs-2";

import {
  dashboardLatencyChart,
  dashboardThroughputChart
} from "variables/charts.jsx";

const DashboardOverview = function() {
    return (
      <div id="overview-block">
        <Row>
          <Col lg="3" md="6" sm="6">
          <a
          href="/admin/dashboard/tx-throughput"
          target="_self"
          style={{"textDecoration": "none"}}
          >
          <Card className="card-stats">
            <CardBody>
              <Row>
                <Col md="4" xs="5">
                <div className="icon-big text-center">
                  <i className="fas fa-bolt text-warning" />
                </div>
                </Col>
                <Col md="8" xs="7">
                <div className="numbers">
                  <p className="card-category">Tx TPS</p>
                  <CardTitle tag="p">150</CardTitle>
                  <p />
                </div>
                </Col>
              </Row>
            </CardBody>
            <CardFooter>
              <hr />
              <div className="stats">
                <i className="fas fa-sync-alt" /> See Details
              </div>
            </CardFooter>
          </Card>
          </a>
          </Col>
          <Col lg="3" md="6" sm="6">
          <a
          href="/admin/dashboard/tx-latency"
          target="_self"
          style={{"textDecoration": "none"}}
          >
          <Card className="card-stats">
            <CardBody>
              <Row>
                <Col md="4" xs="5">
                <div className="icon-big text-center">
                  <i className="fas fa-cloud text-warning" />
                </div>
                </Col>
                <Col md="8" xs="7">
                <div className="numbers">
                  <p className="card-category">Tx Latency</p>
                  <CardTitle tag="p">1345 ms</CardTitle>
                  <p />
                </div>
                </Col>
              </Row>
            </CardBody>
            <CardFooter>
              <hr />
              <div className="stats">
                <i className="fas fa-sync-alt" /> See Details
              </div>
            </CardFooter>
          </Card>
          </a>
          </Col>
          <Col lg="3" md="6" sm="6">
          <a
          href="/admin/dashboard/read-throughput"
          target="_self"
          style={{"textDecoration": "none"}}
          >
          <Card className="card-stats">
            <CardBody>
              <Row>
                <Col md="4" xs="5">
                <div className="icon-big text-center">
                  <i className="fas fa-space-shuttle text-warning" />
                </div>
                </Col>
                <Col md="8" xs="7">
                <div className="numbers">
                  <p className="card-category">Read TPS</p>
                  <CardTitle tag="p">63</CardTitle>
                  <p />
                </div>
                </Col>
              </Row>
            </CardBody>
            <CardFooter>
              <hr />
              <div className="stats">
                <i className="fas fa-sync-alt" /> See Details
              </div>
            </CardFooter>
          </Card>
          </a>
          </Col>
          <Col lg="3" md="6" sm="6">
          <a
          href="/admin/dashboard/read-latency"
          target="_self"
          style={{"textDecoration": "none"}}
          >
          <Card className="card-stats">
            <CardBody>
              <Row>
                <Col md="4" xs="5">
                <div className="icon-big text-center icon-warning">
                  <i className="fas fa-newspaper text-warning" />
                </div>
                </Col>
                <Col md="8" xs="7">
                <div className="numbers">
                  <p className="card-category">Read Latency</p>
                  <CardTitle tag="p">450 ms</CardTitle>
                  <p />
                </div>
                </Col>
              </Row>
            </CardBody>
            <CardFooter>
              <hr />
              <div className="stats">
                <i className="fas fa-sync-alt" /> See Details
              </div>
            </CardFooter>
          </Card>
          </a>
          </Col>
        </Row>
        <Row>
          <Col md="12">
          <Card className="card-chart">
            <CardHeader>
              <CardTitle tag="h5">Throughput Overview</CardTitle>
              <p className="card-category">Line Chart with Points</p>
            </CardHeader>
            <CardBody>
              <Line
                data={dashboardThroughputChart.data}
                options={dashboardThroughputChart.options}
                width={400}
                height={100}
                />
            </CardBody>
            <CardFooter>
              <div className="chart-legend">
                <i className="fa fa-circle text-info" /> Tx Throughput{" "}
                <i className="fa fa-circle text-warning" /> Read Throughput
              </div>
              <hr />
              <div className="card-stats">
                <a
                href="/admin/dashboard"
                style={{
                cursor:"pointer",
                textDecoration:"none",
                color: "#A9A9A9"
                }}
                >
                <i className="fa fa-history" /> Updated 3 minutes ago
                </a>
              </div>
            </CardFooter>
          </Card>
          </Col>
        </Row>
        <Row>
          <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h5">Latency Overview</CardTitle>
              <p className="card-category">[Fast] Green, [Medium] Yellow, [Slow] Red</p>
            </CardHeader>
            <CardBody>
              <Line
                data={dashboardLatencyChart.data}
                options={dashboardLatencyChart.options}
                width={400}
                height={100}
                />
            </CardBody>
            <CardFooter>
              <hr />
              <div className="card-stats">
                <a
                href="/admin/dashboard"
                style={{
                cursor:"pointer",
                textDecoration:"none",
                color: "#A9A9A9"
                }}
                >
                <i className="fa fa-history" /> Updated 3 minutes ago
                </a>
              </div>
            </CardFooter>
          </Card>
          </Col>
        </Row>
      </div>
    );
  }

  export default DashboardOverview;
