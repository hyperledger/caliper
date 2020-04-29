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

import Dashboard from 'views/Dashboard.jsx';
import Documentation from 'views/Documentation.jsx';
import History from 'views/History.jsx';
// import NetworkGraph from "views/NetworkGraph.jsx";
import Configuration from 'views/Configuration.jsx';

let routes = [
    {
        path: '/dashboard',
        name: 'Dashboard',
        icon: 'fas fa-chart-area',
        component: Dashboard,
        layout: '/admin'
    },
    // {
    //   path: "/network-graph",
    //   name: "Network Graph",
    //   icon: "fas fa-network-wired",
    //   component: NetworkGraph,
    //   layout: "/admin"
    // },
    {
        path: '/history',
        name: 'History Benchmarks',
        icon: 'fas fa-archive',
        component: History,
        layout: '/admin'
    },
    {
        path: '/documentation',
        name: 'Documentation',
        icon: 'fas fa-file-alt',
        component: Documentation,
        layout: '/admin'
    },
    {
        path: '/configuration',
        name: 'Configuration',
        icon: 'fas fa-cogs',
        component: Configuration,
        layout: '/admin'
    },
];
export default routes;
