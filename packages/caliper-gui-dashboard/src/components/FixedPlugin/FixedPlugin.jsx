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
/*!

- Caliper GUI includes codes from Creative Time, which is licensed
- under the MIT license:
=========================================================
* Bootstrap Theme Copyright (Paper Dashboard React - v1.1.0)
=========================================================
* Product Page: https://www.creative-tim.com/product/paper-dashboard-react
* Paper Dashboard React - v1.1.0 Copyright 2019 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/paper-dashboard-react/blob/master/LICENSE.md)
* Coded by Creative Tim
=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/

import React, { Component } from "react";

import { Button } from "reactstrap";

class FixedPlugin extends Component {
  constructor(props) {
    super(props);
    this.state = {
      classes: "dropdown"
    };
    this.handleClick = this.handleClick.bind(this);
  }
  handleClick() {
    if (this.state.classes === "dropdown") {
      this.setState({ classes: "dropdown show" });
    } else {
      this.setState({ classes: "dropdown" });
    }
  }
  render() {
    return (
      <div className="fixed-plugin">
        <div className={this.state.classes}>
          <div onClick={this.handleClick}>
            <i className="fa fa-cog fa-2x" />
          </div>
          <ul className="dropdown-menu show">
            <li className="button-container">
              <Button
                href="/admin/configuration"
                color="default"
                block
                className="btn-round"
                outline
              >
                <i className="fas fa-cogs" /> Configuration
              </Button>
            </li>
            <li className="button-container">
              <Button
                href="https://www.hyperledger.org/projects/caliper"
                color="warning"
                block
                className="btn-round"
                target="_blank"
              >
                <i className="fas fa-paper-plane"></i> Hyperledger Caliper
              </Button>
            </li>
          </ul>
        </div>
      </div>
    );
  }
}

export default FixedPlugin;
