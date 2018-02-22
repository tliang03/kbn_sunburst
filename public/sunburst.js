define(function (require) {
  
  // we need to load the css ourselves
  require('plugins/sunburst/sunburst.less');

  // we also need to load the controller and used by the template
  require('plugins/sunburst/sunburst_ctrl');

  // register the provider with the visTypes registry
  require('ui/registry/vis_types').register(MetricVisProvider);


  function MetricVisProvider(Private) {
    var TemplateVisType = Private(require('ui/template_vis_type/template_vis_type'));
    var Schemas = Private(require('ui/vis/schemas'));

    // return the visType object, which kibana will use to display and configure new
    // Vis object of this type.
    return new TemplateVisType({
      name: 'sunburst',
      title: 'Sunburst chart',
      icon: 'fa-sun-o',
      description: 'Sunburst charts are ideal for data that describes sequences of events',
      template: require('plugins/sunburst/sunburst.html'),
      params: {
        defaults: {
          shareYAxis: true,
          addTooltip: true,
          addLegend: true
        },
        // editor: require('plugins/sunburst/sunburst_params.html')
      },
      responseConverter: false,
      hierarchicalData: true,
      implementsRenderComplete: true,
      schemas: new Schemas([{
        group: 'metrics',
        name: 'metric',
        title: 'Slice Size',
        min: 1,
        max: 1,
        aggFilter: ['sum', 'count', 'cardinality'],
        defaults: [{
          schema: 'metric',
          type: 'count'
        }]
      }, {
        group: 'buckets',
        name: 'segment',
        icon: 'fa fa-scissors',
        title: 'Slices Level',
        min: 0,
        max: Infinity,
        aggFilter: '!geohash_grid'
      }])
    });
  }

  // export the provider so that the visType can be required with Private()
  return MetricVisProvider;
});
