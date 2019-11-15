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

// TODO: Finish The Network Graph Functionality By Extracting Network Information From Caliper-cli.
// Once finished, get the route to make this page works.

import React from "react";
import { Graph } from 'react-d3-graph';  // blockchain graph visualization

// reactstrap components
import {
  Card,
  CardBody,
  CardFooter,
  Row,
  Col
} from "reactstrap";

// sample graph visualization data
const data = {
  nodes: [
    { id: '<ORDERER>', symbolType: 'star' },
    { id: 'Peer1', symbolType: 'circle' },
    { id: 'Peer2', symbolType: 'circle' },
    { id: 'Peer3', symbolType: 'circle' },
    { id: 'Peer4', symbolType: 'circle' },
    { id: 'Peer5', symbolType: 'circle' },
    { id: 'Peer6', symbolType: 'circle' },
    { id: 'Channel1', symbolType: 'triangle' },
    { id: 'Channel2', symbolType: 'triangle' },
  ],
  links: [
    { source: 'Channel1', target: 'Peer1' },
    { source: 'Channel1', target: 'Peer2' },
    { source: 'Channel1', target: 'Peer3' },
    { source: 'Channel2', target: 'Peer4' },
    { source: 'Channel2', target: 'Peer5' },
    { source: 'Channel2', target: 'Peer6' },
    { source: '<ORDERER>', target: 'Channel1' },
    { source: '<ORDERER>', target: 'Channel2' },
  ]
};

const graphConfig = {
  "automaticRearrangeAfterDropNode": false,
  "collapsible": false,
  "directed": false,
  "focusAnimationDuration": 0.75,
  "focusZoom": 1,
  "height": 600,
  "highlightDegree": 1,
  "highlightOpacity": 1,
  "linkHighlightBehavior": false,
  "maxZoom": 2,
  "minZoom": 0.5,
  "nodeHighlightBehavior": false,
  "panAndZoom": false,
  "staticGraph": false,
  "width": 1100,
  "d3": {
    "alphaTarget": 0.05,
    "gravity": -100,
    "linkLength": 100,
    "linkStrength": 1
  },
  "node": {
    "color": "#d3d3d3",
    "fontColor": "#F9A044",
    "fontSize": 16,
    "fontWeight": "bold",
    "highlightColor": "SAME",
    "highlightFontSize": 8,
    "highlightFontWeight": "normal",
    "highlightStrokeColor": "SAME",
    "highlightStrokeWidth": "SAME",
    "labelProperty": "id",
    "mouseCursor": "pointer",
    "opacity": 1,
    "renderLabel": true,
    "size": 400,
    "strokeColor": "none",
    "strokeWidth": 1.5,
    "svg": "",
    "symbolType": "circle"
  },
  "link": {
    "color": "#d3d3d3",
    "fontColor": "black",
    "fontSize": 8,
    "fontWeight": "normal",
    "highlightColor": "#d3d3d3",
    "highlightFontSize": 8,
    "highlightFontWeight": "normal",
    "labelProperty": "label",
    "mouseCursor": "pointer",
    "opacity": 0.6,
    "renderLabel": false,
    "semanticStrokeWidth": false,
    "strokeWidth": 1.5
  }
}

// // graph event callbacks
// const onClickGraph = function() {
//   window.alert(`Clicked the graph background`);
// };

// const onClickNode = function(nodeId) {
//   window.alert(`Clicked node ${nodeId}`);
// };

// const onDoubleClickNode = function(nodeId) {
//   window.alert(`Double clicked node ${nodeId}`);
// };

// const onRightClickNode = function(event, nodeId) {
//   window.alert(`Right clicked node ${nodeId}`);
// };

// const onMouseOverNode = function(nodeId) {
//   window.alert(`Mouse over node ${nodeId}`);
// };

// const onMouseOutNode = function(nodeId) {
//   window.alert(`Mouse out node ${nodeId}`);
// };

// const onClickLink = function(source, target) {
//   window.alert(`Clicked link between ${source} and ${target}`);
// };

// const onRightClickLink = function(event, source, target) {
//   window.alert(`Right clicked link between ${source} and ${target}`);
// };

// const onMouseOverLink = function(source, target) {
//   window.alert(`Mouse over in link between ${source} and ${target}`);
// };

// const onMouseOutLink = function(source, target) {
//   window.alert(`Mouse out link between ${source} and ${target}`);
// };

// Graph visualization config end here.-----

class NetworkGraph extends React.Component {
  render() {
    return (
      <>
        <div className="content">
          <Row>
            <Col md="12">
            <Card>
              <CardBody>
                <div className="text-center text-primary">
                  <h2>Network Graph</h2>
                  <h5>Hyperledger Fabric</h5>
                </div>
              </CardBody>
              <CardFooter>
                <hr />
                <div>
                  <Row className="text-center">
                    <Col className="ml-auto" lg="4" md="6" xs="6">
                    <h5>
                      2 <br />
                      <small>Channels</small>
                    </h5>
                    </Col>
                    <Col className="ml-auto mr-auto" lg="4" md="6" xs="6">
                    <h5>
                      1 <br />
                      <small>Orderers</small>
                    </h5>
                    </Col>
                    <Col className="mr-auto" lg="4">
                    <h5>
                      6 <br />
                      <small>Peers</small>
                    </h5>
                    </Col>
                  </Row>
                </div>
              </CardFooter>
            </Card>
            </Col>
          </Row>
          <Row>
            <Col md="12">
            <Card style={{ background: "black" }}>
            <Graph
            id="graph-id" // id is mandatory, if no id is defined rd3g will throw an error
            data={data}
            config={graphConfig}
            />
            </Card>
            </Col>
          </Row>
        </div>
      </>
    );
  }
}

export default NetworkGraph;
