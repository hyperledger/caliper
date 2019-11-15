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
import { HorizontalBar, Doughnut } from "react-chartjs-2";

// reactstrap components
import {
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  CardFooter,
  Table,
  Row,
  Col
} from "reactstrap";

import {
  doughnutData,
  doughnutOptions,
} from "../variables/charts";

var dateOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

const data = {
  labels: [
    new Date("2019-08-01T17:02:05").toLocaleDateString("en-US", dateOptions),
    new Date("2019-08-01T17:03:05").toLocaleDateString("en-US", dateOptions),
    new Date("2019-08-01T17:04:05").toLocaleDateString("en-US", dateOptions),
    new Date("2019-08-01T17:05:05").toLocaleDateString("en-US", dateOptions),
    new Date("2019-08-01T17:06:05").toLocaleDateString("en-US", dateOptions),
    new Date("2019-08-01T17:07:05").toLocaleDateString("en-US", dateOptions),
    new Date("2019-08-01T17:08:05").toLocaleDateString("en-US", dateOptions),
    new Date("2019-08-01T17:09:05").toLocaleDateString("en-US", dateOptions),
  ],
  datasets: [
    {
      label: 'Sample dataset',
      backgroundColor: 'rgba(255,99,132,0.2)',
      borderColor: 'rgba(255,99,132,1)',
      borderWidth: 1,
      hoverBackgroundColor: 'rgba(255,99,132,0.4)',
      hoverBorderColor: 'rgba(255,99,132,1)',
      data: [65, 59, 80, 81, 56, 55, 40, 10]
    }
  ]
};

// visualization options
const options = {
  scales: {
    yAxes: [{
      ticks: {
        autoSkip: false,
        maxRotation: 0,
        minRotation: 0,
      },
    }],
    xAxes: [{
      ticks: {
        beginAtZero: true,
      }
    }]
  }
}

class History extends React.Component {
  render() {
    return (
      <>
      <div className="content">
        <Row>
          <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle tag="h4">Benchmark Histories</CardTitle>
            </CardHeader>
            <CardBody>
              <Table responsive>
                <thead className="text-primary">
                  <tr>
                    <th>Date</th>
                    <th>Ave. Read Latency</th>
                    <th>Ave. Read Throughput</th>
                    <th>Ave. Tx. Latency</th>
                    <th className="text-right">Ave. Tx. Throughput</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{new Date("2019-08-01T17:02:05").toLocaleDateString("en-US", dateOptions)}</td>
                    <td>33 ms</td>
                    <td>1000</td>
                    <td>50 ms</td>
                    <td className="text-right">952</td>
                  </tr>
                  <tr>
                    <td>{new Date("2019-08-02T08:23:05").toLocaleDateString("en-US", dateOptions)}</td>
                    <td>35 ms</td>
                    <td>800</td>
                    <td>60 ms</td>
                    <td className="text-right">1430</td>
                  </tr>
                  <tr>
                    <td>{new Date("2019-08-03T07:23:05").toLocaleDateString("en-US", dateOptions)}</td>
                    <td>30 ms</td>
                    <td>948</td>
                    <td>45 ms</td>
                    <td className="text-right">1040</td>
                  </tr>
                  <tr>
                    <td>{new Date("2019-08-03T17:23:05").toLocaleDateString("en-US", dateOptions)}</td>
                    <td>30 ms</td>
                    <td>394</td>
                    <td>90 ms</td>
                    <td className="text-right">845</td>
                  </tr>
                  <tr>
                    <td>{new Date().toLocaleDateString("en-US", dateOptions)}</td>
                    <td>45 ms</td>
                    <td>1049</td>
                    <td>53 ms</td>
                    <td className="text-right">1340</td>
                  </tr>
                </tbody>
              </Table>
              <hr />
              <p className="description">I will add clickable links to detailed JSON data (MongoDB?)</p>
            </CardBody>
          </Card>
          </Col>
        </Row>
        <Row>
          <Col md="12">
          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
              <p className='card-category'>
                Doughnut Chart for Success Rate Visualization with Patternse
              </p>
            </CardHeader>
            <CardBody>
              <Doughnut
                data={doughnutData}
                options={doughnutOptions}
                height={300}
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
          <Col md="6">
          <Card>
            <CardHeader>
              <CardTitle>
                Tx Throughput History
              </CardTitle>
            </CardHeader>
            <CardBody>
              <HorizontalBar data={data} options={options} />
            </CardBody>
          </Card>
          </Col>
          <Col md="6">
          <Card>
            <CardHeader>
              <CardTitle>
                Tx Latency History
              </CardTitle>
            </CardHeader>
            <CardBody>
              <HorizontalBar data={data} options={options} />
            </CardBody>
          </Card>
          </Col>
        </Row>
        <Row>
          <Col md="6">
          <Card>
            <CardHeader>
              <CardTitle>
                Read Throughput History
              </CardTitle>
            </CardHeader>
            <CardBody>
              <HorizontalBar data={data} options={options} />
            </CardBody>
          </Card>
          </Col>
          <Col md="6">
          <Card>
            <CardHeader>
              <CardTitle>
                Read Latency History
              </CardTitle>
            </CardHeader>
            <CardBody>
              <HorizontalBar data={data} options={options} />
            </CardBody>
          </Card>
          </Col>
        </Row>
      </div>
      </>
    );
  }
}

export default History;
