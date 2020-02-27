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
var dateOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

const dashboardLatencyChart = {
  data: canvas => {
      return {
          labels: [
              new Date("2019-08-01T17:02:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:03:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:04:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:05:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:06:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:07:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:08:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:09:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:10:05").toLocaleDateString("en-US", dateOptions),
              new Date("2019-08-01T17:12:05").toLocaleDateString("en-US", dateOptions),
              new Date().toLocaleDateString("en-US", dateOptions)
          ],
          datasets: [{
                  borderColor: "#6bd098",
                  backgroundColor: "#6bd098",
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  borderWidth: 3,
                  data: [300, 310, 316, 322, 330, 326, 333, 345, 338, 354, 360]
              },
              {
                  borderColor: "#fcc468",
                  backgroundColor: "#fcc468",
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  borderWidth: 3,
                  data: [320, 340, 365, 360, 370, 385, 390, 384, 408, 420, 460]
              },
              {
                  borderColor: "#f17e5d",
                  backgroundColor: "#f17e5d",
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  borderWidth: 3,
                  data: [370, 394, 415, 409, 425, 445, 460, 450, 478, 484, 900]
              }
          ]
      };
  },
  options: {
      legend: {
          display: false
      },

      tooltips: {
          enabled: false
      },

      scales: {
          yAxes: [{
              ticks: {
                  fontColor: "#9f9f9f",
                  beginAtZero: false,
                  maxTicksLimit: 5
              },
              gridLines: {
                  drawBorder: false,
                  zeroLineColor: "#ccc",
                  color: "rgba(255,255,255,0.05)"
              }
          }],

          xAxes: [{
              barPercentage: 1.6,
              gridLines: {
                  drawBorder: false,
                  color: "rgba(255,255,255,0.1)",
                  zeroLineColor: "transparent",
                  display: false
              },
              ticks: {
                  padding: 20,
                  fontColor: "#9f9f9f"
              }
          }]
      }
  }
};

const dashboardThroughputChart = {
  data: {
      labels: [
          "1h",
          "2h",
          "3h",
          "4h",
          "5h",
          "6h",
          "7h",
          "8h",
          "9h",
          "10h",
          "11h",
          "12h"
      ],
      datasets: [{
              data: [100, 109, 150, 200, 300, 400, 400, 500, 250, 300, 500, 700],
              fill: false,
              borderColor: "#fbc658",
              backgroundColor: "transparent",
              pointBorderColor: "#fbc658",
              pointRadius: 4,
              pointHoverRadius: 4,
              pointBorderWidth: 8
          },
          {
              data: [500, 200, 100, 200, 350, 400, 500, 560, 250, 400, 300, 800],
              fill: false,
              borderColor: "#51CACF",
              backgroundColor: "transparent",
              pointBorderColor: "#51CACF",
              pointRadius: 4,
              pointHoverRadius: 4,
              pointBorderWidth: 8
          }
      ]
  },
  options: {
      legend: {
          display: false,
          position: "top"
      }
  }
};

// Chart Data for detailed calipe-gui dashboard charts

const myData = {
  labels: ["2019-08-02T08:34:01", "2019-08-02T08:34:02", "2019-08-02T08:34:03", "2019-08-02T08:34:04", "2019-08-02T08:34:05", "2019-08-02T08:34:10", "2019-08-02T08:34:12", "2019-08-02T08:34:15", "2019-08-02T08:34:18", "2019-08-02T08:34:40", "2019-08-02T08:34:50", "2019-08-02T08:35:01"],
  datasets: [{
      data: [600, 400, 600, 550, 700, 500, 600, 700, 500, 550, 600, 700],
      label: 'Latency Data',
      fill: true,
      lineTension: 0,
      backgroundColor: 'rgba(75,192,192,0.1)',
      borderColor: 'rgba(75,192,192,1)',
      borderCapStyle: 'butt',
      borderDash: [],
      borderDashOffset: 0.0,
      borderJoinStyle: 'miter',
      pointBorderColor: 'rgba(75,192,192,1)',
      pointBackgroundColor: '#fff',
      pointBorderWidth: 2,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: 'rgba(75,192,192,1)',
      pointHoverBorderColor: 'rgba(220,220,220,1)',
      pointHoverBorderWidth: 1,
      pointRadius: 1,
      pointHitRadius: 10,
  }]
};


const barData = {
  labels: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  datasets: [{
          label: 'Fast',
          fill: false,
          lineTension: 0.5,
          backgroundColor: 'rgba(107, 208, 152, 0.7)',
          hoverBackgroundColor: 'rgba(107, 208, 152, 1)',
          borderColor: 'rgba(255, 255, 255, 1)',
          borderCapStyle: 'butt',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'miter',
          pointBorderColor: 'pink',
          pointBackgroundColor: '#fff',
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: 'rgba(75,192,192,1)',
          pointHoverBorderColor: 'rgba(220,220,220,1)',
          pointHoverBorderWidth: 2,
          pointRadius: 1,
          pointHitRadius: 10,
          data: [500, 390, 670, 600, 780, 440, 600, 680, 550, 475, 700, 795]
      },
      {
          label: 'Normal',
          fill: false,
          lineTension: 0.5,
          backgroundColor: 'rgba(255, 206, 86, 0.7)',
          hoverBackgroundColor: 'rgba(255, 206, 86, 1)',
          borderColor: 'rgba(255, 255, 255, 1)',
          borderCapStyle: 'butt',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'miter',
          pointBorderColor: 'pink',
          pointBackgroundColor: '#fff',
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: 'rgba(75,192,192,1)',
          pointHoverBorderColor: 'rgba(220,220,220,1)',
          pointHoverBorderWidth: 2,
          pointRadius: 1,
          pointHitRadius: 10,
          data: [500, 390, 670, 600, 780, 440, 600, 680, 550, 475, 700, 795]
      },
      {
          label: 'Slow',
          fill: false,
          lineTension: 0.5,
          backgroundColor: 'rgba(255, 99, 132, 0.7)',
          hoverBackgroundColor: 'rgba(255, 99, 132, 1)',
          borderColor: 'rgba(255, 255, 255, 1)',
          borderCapStyle: 'butt',
          borderDash: [],
          borderDashOffset: 0.0,
          borderJoinStyle: 'miter',
          pointBorderColor: 'pink',
          pointBackgroundColor: '#fff',
          pointBorderWidth: 1,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: 'rgba(75,192,192,1)',
          pointHoverBorderColor: 'rgba(220,220,220,1)',
          pointHoverBorderWidth: 2,
          pointRadius: 1,
          pointHitRadius: 10,
          data: [500, 390, 670, 600, 780, 440, 600, 680, 550, 475, 700, 795]
      }
  ]
};


const doughnutData = {
  labels: [
      'Fail',
      'Success',
      'Warning'
  ],
  datasets: [{
      data: [20, 500, 100],
      backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(107, 208, 152, 0.7)',
          'rgba(255, 206, 86, 0.7)',
      ],
      hoverBackgroundColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(107, 208, 152, 1)',
          'rgba(255, 206, 86, 1)',
      ]
  }]
};

const radarData = {
  labels: [
      'Read Latency',
      'Read Throughput', 'Tx. Latency', 'Tx. Throughput', 'Success Rate'
  ],
  datasets: [{
          label: 'My First dataset',
          backgroundColor: 'rgba(179,181,198,0.2)',
          borderColor: 'rgba(179,181,198,1)',
          pointBackgroundColor: 'rgba(179,181,198,1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(179,181,198,1)',
          data: [65, 59, 90, 81, 88]
      },
      {
          label: 'My Second dataset',
          backgroundColor: 'rgba(255,99,132,0.2)',
          borderColor: 'rgba(255,99,132,1)',
          pointBackgroundColor: 'rgba(255,99,132,1)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgba(255,99,132,1)',
          data: [80, 96, 27, 100, 99]
      }
  ]
};

// All the options

const lineOptions = {
  fill: false,
  responsive: true,
  legend: {
      labels: {
          usePointStyle: false,
      },
  },
  scales: {
      xAxes: [{
          type: 'time',
          display: true,
          scaleLabel: {
              display: true,
              labelString: "Time",
          }
      }],
      yAxes: [{
          ticks: {
              beginAtZero: true,
          },
          display: true,
          scaleLabel: {
              display: true,
              labelString: "Latency (ms)",
          }
      }]
  }
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
      yAxes: [{
          ticks: {
              beginAtZero: true,
              display: true,
          },
          gridLines: {
              display: false,
          },
          stacked: true,
      }],
      xAxes: [{
          ticks: {
              display: true,
          },
          gridLines: {
              display: false,
          },
          stacked: true,
      }],
  },
  legend: {
      display: true,
      onClick: (e) => e.stopPropagation(),
      position: "bottom",
      labels: {
          usePointStyle: false,
      }
  },
  tooltips: {
      enabled: true,
  },
}

const radarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  legend: {
      display: true,
      onClick: (e) => e.stopPropagation(),
      position: "bottom",
      labels: {
          usePointStyle: true,
      }
  },
  tooltips: {
      enabled: true,
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
      yAxes: [{
          display: false,
      }],
      xAxes: [{
          display: false,
      }],
  },
  tooltips: {
      enabled: true,
  },
  legend: {
      display: true,
      onClick: (e) => e.stopPropagation(),
      position: "left",
      labels: {
          usePointStyle: false,
      }
  },
}

module.exports = {
  dashboardLatencyChart,
  dashboardThroughputChart,
  myData,
  barData,
  doughnutData,
  radarData,
  lineOptions,
  barOptions,
  radarOptions,
  doughnutOptions
};
