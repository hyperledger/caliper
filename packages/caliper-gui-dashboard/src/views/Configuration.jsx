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
  Alert,
  Button,
  Row,
  Col,
  Spinner,
} from "reactstrap";

// import configuration forms
import TestConfigurationForm from "../components/Forms/TestConfigurationForm";
import FabricConfigurationForm from "../components/Forms/FabricConfigurationForm";
import GenerateTestConfigurationForm from "../components/Forms/GenerateTestConfigurationForm";
import ConfigurationGuide from "../components/Forms/ConfigurationGuide";

// used for api calling
import axios from "axios";
let testApi = "http://localhost:3001/v1/run-test/";

class Configuration extends React.Component {
  constructor(props) {
    super(props);
    // using React references to call child component functions
    this.testConfigElement = React.createRef();
    this.networkConfigElment = React.createRef();
    this.state = {
      testConfigSet: false,
      networkConfigSet: false,
      useSample: false,
      testStarted: false,
      testResult: null,
    };
  }

  // Set the state of test configuration file
  // @bool: true if test configuration file is uploaded, false otherwise.
  setTestConfig = (bool) => {
    this.setState({ testConfigSet: bool });
  }

  // Set the state of network configuration file
  // @bool: true if network configuration file is uploaded, false otherwise.
  setNetworkConfig = (bool) => {
    this.setState({ networkConfigSet: bool });
  }

  // Tell the server to use sample config files
  handleUseSample = () => {
    let useSample = true;
    this.setState({
      testConfigSet: true,
      networkConfigSet: true,
      useSample: useSample,
    })
    // update the upload states of child test and network config components
    this.testConfigElement.current.setUploaded(true);
    this.networkConfigElment.current.setUploaded(true);
  }

  // reset button functionality
  resetButton = () => {
    // clear the config files in test and network config child components
    this.testConfigElement.current.removeFile();
    this.networkConfigElment.current.removeFile();
    this.setState({
      testConfigSet: false,
      networkConfigSet: false,
      useSample: false,
    })
  }

  // Start caliper-cli test with get API request
  startTest = async () => {
    if (!this.state.useSample && (!this.state.testConfigSet || !this.state.networkConfigSet)) {
      console.error("You Didn't Upload All The Required Config Files!")
      return null;
    }

    this.setState({ 
      testStarted: true,  // prevent user double click on the test.
      testResult: null,
    });

    /*
      Setting test api call to the caliper-server, and get returned results
      for data visualization.
    */
    let result = null;
    let api = testApi + (this.state.useSample ? "true" : "false");
    await axios.get(api)
    .then((res) => {
      result = { ...result, res: res };
      console.log(result);
    })
    .catch((err) => {
      console.error(err);
    });

    /* 
     * TODO:
     *  Globally update the test result data and clean it for visualization.
     *  Then jump to the dashoboard page.
     *  Connecting Socket.io between client and server to get real time data.
     */
    this.setState({
      testStarted: false,
      testResult: result,
    });

    console.log("[DEBUG] ****** TEST FINISHED ********\n",this.state.testResult, this.state.testStarted);
  }

  render() {
    return (
      <>
        <div className="content">
          <div className="text-center">
            {
            this.state.testStarted ?
            <>
            <Spinner type="grow" color="warning" />
            <Button
              color="success"
              style={{width:"300px"}}
              disabled
              >
            Test Started
            </Button>
            </>
            :
            <Button
            color="warning"
            style={{width:"300px"}}
            onClick={this.startTest}
            disabled={!(this.state.testConfigSet && this.state.networkConfigSet)}>
            Start Test
            </Button>
            }
            <Button color="danger" style={{width:"100px"}} onClick={this.resetButton}>Reset</Button>
            <p className="card-category">
              Test can be started once both "test" and "network" config files are uploaded
            </p>
          </div>
          <div className="text-center">
            <Button outline color={this.state.useSample ? "primary" : "primary"} style={{width:"300px"}} onClick={this.handleUseSample}>Using Sample Config Files</Button>
            <p className="card-category">
              Testing With Sample Test & Network Configuration Files
            </p>
            <Alert color="warning" isOpen={this.state.useSample}><b>Sample Config Files</b> Uploaded!</Alert>
          </div>
          <Row>
            <Col className="ml-auto mr-auto" md="10">
            <ConfigurationGuide />
            </Col>
          </Row>
          <hr />
          <Row>
            <Col className="ml-auto mr-auto" md="10">
            <FabricConfigurationForm action={this.setNetworkConfig} ref={this.networkConfigElment} />
            </Col>
          </Row>
          <Row>
            <Col className="ml-auto mr-auto" md="10">
            <TestConfigurationForm action={this.setTestConfig} ref={this.testConfigElement} />
            </Col>
          </Row>
          <hr />
          <Row>
            <Col className="ml-auto mr-auto" md="10">
            <GenerateTestConfigurationForm />
            </Col>
          </Row>
        </div>
      </>
    );
  }
}

export default Configuration;