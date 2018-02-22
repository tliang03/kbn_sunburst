import VislibVisTypeBuildChartDataProvider from 'ui/vislib_vis_type/build_chart_data';
import VislibComponentsColorColorProvider from 'ui/vislib/components/color/color';
import AggResponseIndexProvider from 'ui/agg_response/index';
import uiModules from 'ui/modules';
import errors from 'ui/errors'; 
import VislibProvider from 'ui/vislib';
import VislibLibHandlerHandlerProvider from 'ui/vislib/lib/handler/handler';

define(function (require) {
  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

  var _ = require('lodash');
  var d3 = require('d3');
  var _lodash2 = _interopRequireDefault(_);

  var module = require('ui/modules').get('kibana/vr_vis', ['kibana']);

  module.controller('SunburstController', function($scope, $rootScope, $element, Private) {
    let buildChartData = Private(VislibVisTypeBuildChartDataProvider);
    let aggResponse = Private(AggResponseIndexProvider);
    let vislib = Private(VislibProvider);
    const color = Private(VislibComponentsColorColorProvider);
    const Handler = Private(VislibLibHandlerHandlerProvider);

    let totalSize = 0;

    let data = {};

    let b = {
      w: 90,
      h: 30,
      s: 3,
      t: 10
    };

    let labels = {
      'metric': '',
      'segment': []
    };

    let w = null;
    let h = null;   

    $scope.chart = null;
    $scope.draw = function(data) {
      let slices = data.slices;
      if (!slices || !slices.children || !slices.children.length) return; 
      let el = d3.select('.chartsunburst')     
      el.selectAll('*').remove();
      $scope.chart = null;
      let width = $('.sunburst-sg').closest('div.visualize-chart').width();
      let height = $('.sunburst-sg').closest('div.visualize-chart').height() - 70;
      w = width;
      h = height;
      if(width <=0 || height <=0 ) return;      

      let radius = Math.min(width, height) / 2;
      let path;

      _setLabels(data.raw.columns);
      $scope.addExplanation(width, height, el);
      $scope.addSequence(width, height, el);

      $scope.chart = el.append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('id', 'container')
            .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

      path = $scope.addPath(width, height, radius, slices);

      let isTooltip = $scope.vis.params.addTooltip;
      if (isTooltip) {
        path.on('mouseover', _mouseOver);
        d3.select("#container").on('mouseleave', _mouseLeave);
      }

      totalSize = path.node().__data__.value;
    }

    // Get query results ElasticSearch
    $scope.$watch('esResponse', function (resp) {
      if (resp) {
        const vis = $scope.vis;        
        data = {};
        if (vis.isHierarchical()) {
          // the hierarchical converter is very self-contained (woot!)
           data = aggResponse.hierarchical(vis, resp);           
           if (!data) return;  
        }
        $scope.draw(data);
      }
    });

    // Automatic resizing of graphics
    $scope.$watch(
      function () {
        let width = $('.sunburst-sg').closest('div.visualize-chart').width();
        let height = $('.sunburst-sg').closest('div.visualize-chart').height() - 70;

        if(w === width && h === height) return;
        $scope.draw(data);     
      }, 
      true
    );

    $scope.addExplanation = function(width, height, el) {
      let divW = width / 2 - 70;
      let divH = height / 2;
      let div = el.append('div')
        .attr('id', 'explanation')
        .attr('class', 'sunburst_percentage')
        .style('left', divW + 'px')
        .style('top', divH + 'px')
        .style('margin-top', 50 + 'px');

      div.append('span')
        .attr('id', 'msg');
      div.append('br');

      div.append('div')
        .attr('id', 'label')
        .text(labels['metric'])
        .style('visibility', 'hidden');

      return div;
    };

    $scope.addSequence = function(width, height, el) {
      let sequenceDiv = el.append('div')
        .attr('id', 'sequence');
      let trail = d3.select("#sequence").append("svg")
        .attr("width", width)
        .attr('class', 'sunburst')
        .attr("height", 50)
        .attr("id", "trail");

      // Add the label at the end, for the percentage.
      trail.append("svg:text")
        .attr("id", "endlabel")
        .style("fill", "#000");
    };

    $scope.addPath =  function(width, height, radius, data) {
        let self = this;
        let colorFunc = getPieColorFunc(data);

        let arc = d3.svg.arc()
          .startAngle(function(d) {
            return d.x;
          })
          .endAngle(function(d) {
            return d.x + d.dx;
          })
          .innerRadius(function(d) {
            return Math.sqrt(d.y);
          })
          .outerRadius(function(d) {
            return Math.sqrt(d.y + d.dy);
          });

        let partition = d3.layout.partition()
          .sort(null)
          .size([2 * Math.PI, radius * radius])
          .value(function(d) {
            return d.size ? d.size : 1;
          });

        let path = $scope.chart.datum(data).selectAll("path")
          .data(partition.nodes)
          .enter().append("path")
          .attr("display", function(d) {
            return d.depth ? null : "none";
          }) // hide inner ring
          .attr("d", arc)
          .style("stroke", "#fff")
          .style("fill",
            function(d) {
              let dColor = colorFunc(d.name);
              d.color = dColor;
              return dColor;
            })
          .style("fill-rule", "evenodd")
          .each(stash);
        return path;
    };


    function  getPieColorFunc(data) {
      var uiState = $scope.vis.getUiState();
      return color(data.children.map(function (d) {
        return d.name;
      }), uiState.get('vis.colors'));
    };

    function _setLabels(columns) {
      labels['segment'] = [];
      columns.forEach(function(column) {
        if (column && column.categoryName) {
          if (column.categoryName === 'segment') {
            labels['segment'].push(column);
          } else if (column.categoryName === 'metric') {
            if (labels['metric'] || column.label !== labels['metric']) {
              labels['metric'] = column.label;
            }
          }
        }
      });
    };

    // Stash the old values for transition.
    function stash(d) {
      d.x0 = d.x;
      d.dx0 = d.dx;
    };

    // Interpolate the arcs in data space.
    function arcTween(a) {
      let i = d3.interpolate({
        x: a.x0,
        dx: a.dx0
      }, a);
      return function(t) {
        let b = i(t);
        a.x0 = b.x;
        a.dx0 = b.dx;
        return arc(b);
      };
    };

    function _mouseOver(d) {

      let sequenceArray = getAncestors(d);

      updateBreadcrumbs(sequenceArray);

      d3.select("#msg")
        .style("visibility", "");
      d3.select("#label")
        .style("visibility", "");
      // Fade all the segments.
      d3.selectAll('path')
        .style('opacity', 0.3);

      // Then highlight only those that are an ancestor of the current segment.
      d3.selectAll('path')
        .filter(function(node) {
          return (sequenceArray.indexOf(node) >= 0);
        })
        .style('opacity', 1);

      let percentage = (100 * d.value / totalSize).toPrecision(3);
      let percentageString = percentage + "%";
      if (percentage < 0.1) {
        percentageString = "< 0.1%";
      }

      d3.select("#msg")
        .text(percentageString);

      let endLabel = _getEndLabel(d, percentageString);
      d3.select('#endlabel')
        .text(endLabel);
    };

    function _getEndLabel(d, msg) {
      let str = labels['metric'] + ':';
      if (d.value) {
        str += d.value;
      }
      str += '(' + msg + ')';
      return str;
    };

    function updateBreadcrumbs(nodeArray) {
      let w = [];
      // Data join; key function combines name and depth (= position in sequence).
      let g = d3.select("#trail")
        .selectAll("g")
        .data(nodeArray, function(d) {
          return d.name + d.depth;
        });
      // Add breadcrumb and label for entering nodes.
      let entering = g.enter().append("g");
      let color = d3.scale.category20c();

      entering.append("polygon")
        .attr("points", breadcrumbPoints)
        .style("fill",
          function(d) {
            return d.color;
          });

      entering.append("text")
        .text(function(d, i) {
          return d.name;
        })
        .attr("x", function(d, i) {
          let value = d.name;
          let width = b.w;
          if (value.length && value.length > 10) {
            width += value.length * 3;
          }
          return (width + b.t) / 2;
        })
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle");


      // Set position for entering and updating nodes.
      g.attr("transform", function(d, i) {
        let x = 0;
        let width = b.w;
        let value = d.name;
        if (value.length && value.length > 10) {
          width += value.length * 3;
        }
        w.forEach(function(width) {
          x += width;
        });
        w[i] = width + b.s;

        return "translate(" + x + ", 0)";
      });

      // Remove exiting nodes.
      g.exit().remove();

      // Now move and update the percentage at the end.
      d3.select("#trail").select("#endlabel")
        .attr("x", function(d) {
          let x = 0;
          w.forEach(function(width) {
            x += width;
          });
          x += b.w + b.s;
          return x;
        })
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle");

      // Make the breadcrumb trail visible, if it's hidden.
      d3.select("#trail")
        .style("visibility", "");
    };

    // Generate a string that describes the points of a breadcrumb polygon.
    function breadcrumbPoints(d, i) {
      let width = b.w;
      let value = d.name;
      if (value.length && value.length > 10) {
        width += value.length * 3;
      }
      let points = [];
      points.push("0,0");
      points.push(width + ",0");
      points.push(width + b.t + "," + (b.h / 2));
      points.push(width + "," + b.h);
      points.push("0," + b.h);
      if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
        points.push(b.t + "," + (b.h / 2));
      }
      return points.join(" ");
    };

    function _mouseLeave(d) {
      // Hide the breadcrumb trail
      d3.select("#trail")
        .style("visibility", "hidden");
      // Deactivate all segments during transition.
      d3.selectAll("path").on("mouseover", null);

      d3.select("#msg")
        .style("visibility", "hidden");
      d3.select("#label")
        .style("visibility", "hidden");

      // Transition each segment to full opacity and then reactivate it.
      d3.selectAll("path")
        .transition()
        .style("opacity", 1)
        .each("end", function() {
          d3.select(this).on("mouseover", _mouseOver);
        });
    }

    // Given a node in a partition layout, return an array of all of its ancestor
    // nodes, highest first, but excluding the root.
    function getAncestors(node) {
      let path = [];
      let current = node;
      while (current.parent) {
        path.unshift(current);
        current = current.parent;
      }
      return path;
    };

  })
});
