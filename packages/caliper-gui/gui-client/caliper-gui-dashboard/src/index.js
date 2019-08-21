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

import React from "react";
import ReactDOM from "react-dom";
import { createBrowserHistory } from "history";
import { Router, Route, Switch, Redirect } from "react-router-dom";

import "bootstrap/dist/css/bootstrap.css";
import "assets/scss/paper-dashboard.scss?v=1.1.0";
import "assets/demo/demo.css";
import "perfect-scrollbar/css/perfect-scrollbar.css";
// import "react-notification-alert/dist/animate.css";

import AdminLayout from "layouts/Admin.jsx";

const hist = createBrowserHistory();

ReactDOM.render(
  <Router history={hist}>
    <Switch>
      <Route path="/admin" render={props => <AdminLayout {...props} />} />
      <Redirect to="/admin/dashboard" />
    </Switch>
  </Router>,
  document.getElementById("root")
);

// Hot module replacement
if (module.hot) {
  module.hot.accept();
}