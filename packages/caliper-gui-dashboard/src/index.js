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

/*jshint esversion: 6 */

import React from 'react';
import ReactDOM from 'react-dom';
import { createBrowserHistory } from 'history';
import { Router, Route, Switch, Redirect } from 'react-router-dom';

// import 'assets/fonts/css/all.min.css';
import 'bootstrap/dist/css/bootstrap.css';
import 'assets/scss/paper-dashboard.scss?v=1.1.0';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
// import 'react-notification-alert/dist/animate.css';
import AdminLayout from 'layouts/Admin.jsx';

const hist = createBrowserHistory();

ReactDOM.render(
    <Router history={hist}>
        <Switch>
            <Route path='/admin' render={props => <AdminLayout {...props} />} />
            <Redirect to='/admin/dashboard' />
        </Switch>
    </Router>,
    document.getElementById('root')
);

// Hot module replacement
if (module.hot) {
    module.hot.accept();
}
