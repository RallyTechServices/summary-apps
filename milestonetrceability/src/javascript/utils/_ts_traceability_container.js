Ext.define('CArABU.container.TraceabilityContainer',{
    extend: 'Ext.container.Container',
    alias: 'widget.tstraceabilitycontainer',

    layout: {
        type: 'vbox',
        align:'stretch'
    },

    margin: 5,
    padding: 5,

    config: {
        /**
         * @cfg [{Model}]
         * A list of artifacts to display data about
         */
        artifacts: []
    },

    constructor: function(config) {
        config = config || {};
        this.mergeConfig(config);
        this.callParent([this.config]);
    },

    beforeRender: function() {
        this.callParent(arguments);
        this._buildItems();
    },

    _hasChildren: function(artifact) {
        return ( !Ext.isEmpty(artifact.get('__defects'))
            || !Ext.isEmpty(artifact.get('__tasks'))
            || !Ext.isEmpty(artifact.get('__testcases'))
        );
    },

    // might want to rewrite to use a template instead
    _buildItems: function() {
        if ( this.artifacts.length === 0 ) {
            this.add({xtype:'container',html:'No User Stories assigned.'});
        }
        var summary_template = this._getArtifactSummaryTemplate();

        Ext.Array.each(this.artifacts, function(artifact){
            var container = this.add({
                xtype:'container',
                margin:5,
                padding: 5
            });
            container.add({
                xtype:'container',
                html: summary_template.apply(artifact.getData()),
                defaults: { margins: 5, padding: 5 }
            });

            var subcontainer = container.add({
                xtype:'container',
                html: '',
                defaults: { margins: 5, padding: 5 }
            });

            if ( !this._hasChildren(artifact) ) {
                subcontainer.update('No Children Artifacts');
            } else {
                 var grid_box = container.add({
                      xtype:'container',
                      layout: 'hbox',
                      cls: 'pb',
                      defaults: { margin: 5, padding: 5 },
                      html:''
                 });

                 grid_box.add(this._getBigGridFor(artifact));
                //  grid_box.add(this._getGridFor('task',artifact));
                //  grid_box.add(this._getGridFor('defect',artifact));
                //  grid_box.add(this._getGridFor('testcase',artifact));
            }
        },this);
    },

    _getArtifactSummaryTemplate: function() {
        return new Ext.XTemplate('<span class="ts-trace-heading"><a target="_top" href="{[this.getUrl(values)]}">{FormattedID} {Name}</a>' +
            ' - ( Plan Estimate: {PlanEstimate} )' +
            ' - {ScheduleState} {[this.getFeatureInfo(values)]}' +
            '</span>',
            {
                getUrl: function(object) {
                    return Rally.nav.Manager.getDetailUrl(object);
                },
                getFeatureInfo: function(object) {
                    var feature = object.PortfolioItem;
                    if ( Ext.isEmpty(feature) ) {
                        return "";
                    }
                    return Ext.String.format('(<a target="_top" href="{0}">{1}</a>)',
                        Rally.nav.Manager.getDetailUrl(feature),
                        feature.FormattedID
                    );
                }
            }
        );
    },

    _getBigGridFor: function(artifact) {
        var tasks = artifact.get("__tasks");
        var task_length = tasks.length || 0;
        var defects = artifact.get("__defects");
        var defect_length = defects.length || 0;
        var tests = artifact.get("__testcases");
        var test_length = tests.length || 0;

        var max_length = Ext.Array.max([task_length,defect_length,test_length]);

        var records = [];
        for ( var i=0;i<max_length;i++) {
            var record = { task: null, defect: null, testcase: null };
            if ( i < task_length ) { record.task = tasks[i]; }
            if ( i < defect_length ) { record.defect = defects[i]; }
            if ( i < test_length ) { record.testcase = tests[i]; }
            records.push(record);
        }

        var columns = this._getAllColumns();

        var html = "<table class='child-table'><tbody>";

        html += "<thead><tr>";
        Ext.Array.each(columns, function(column){
            if ( column.width ) {
                html += '<th style="width:' + column.width + ';">';
            } else {
                html += "<th>";
            }

            html += Ext.String.format("<b>{0}</b></th>", column.text );
        });
        html += "</tr></thead>";

        Ext.Array.each(records, function(child){
            html += "<tr>";
            Ext.Array.each(columns, function(column){
                html += "<td>";
                var field = column.dataIndex;
                var value = child[field];
                if ( Ext.isFunction(column.renderer) ) {
                    html += column.renderer(value,null,child);
                } else {
                    html += value;
                }
                html += "</td>";
            });
            html += "<tr>";
        });

        html += "</tbody></table>";

        return {
            xtype:'container',
            html: html
        };
    },

    _getEmptyRecord: function(){
        var record = {};

    },

    _getGridFor: function(type,artifact){
        var fieldname = "__" + type + "s";
        var columns = this._getColumns(type);
        var data = artifact.get(fieldname);

        var html = "<table class='child-table'><tbody>";

        html += "<thead><tr>";
        Ext.Array.each(columns, function(column){
            html += "<th>" +
                column.text +
                "</th>";
        });
        html += "</tr></thead>";

        Ext.Array.each(data, function(child){
            html += "<tr>";
            Ext.Array.each(columns, function(column){
                html += "<td>";
                var field = column.dataIndex;
                var value = child.get(field);
                if ( Ext.isFunction(column.renderer) ) {
                    html += column.renderer(value,null,child);
                } else {
                    html += value;
                }
                html += "</td>";
            });
            html += "<tr>";
        });

        html += "</tbody></table>";
        return {
            xtype:'container',
            html: html
        };

        // return( {
        //     xtype:'rallygrid',
        //     columnCfgs: columns,
        //     store: store,
        //     flex: 1,
        //     cls: 'ts-grid',
        //     showPagingToolbar: false,
        //     showRowActionsColumn: false
        // });
    },

    _getAllColumns: function() {
        var types = ['task','defect','testcase'];
        var state_fields = {
            'task': 'State',
            'defect': 'State',
            'testcase':'LastVerdict'
        };

        var header_text = {
            'task': 'Task',
            'defect': 'Defect',
            'testcase':'Test'
        };

        var cols =[];

        Ext.Array.each(types, function(type,idx){
            cols.push({
                dataIndex: type,
                width: "33%",
                text:header_text[type] + ' ID - Name',
                flex: 1,
                renderer: function(record,meta,row){
                    if ( ! record) {
                        return "";
                    }
                    var link = Rally.nav.Manager.getDetailUrl(record);

                    return Ext.String.format('<a target="_top" href="{0}">{1} - {2}</a>',
                        link,
                        record.get('FormattedID'),
                        record.get('Name')
                    );
                }
            });
            cols.push({
                dataIndex:type,
                text:'State',
                width: 50,
                renderer: function(record,meta,row) {
                    if ( !record ) { return ""; }
                    return record.get(state_fields[type]);
                }
            });
            if ( idx != 2 ) {
                cols.push({
                    dataIndex: type,
                    width: "0px",
                    text: ' ',
                    renderer: function(record,meta,row) {
                        return " ";
                    }
                });
            }
        });

        return cols;
    },

    _getColumns: function(type) {
        var state_fields = {
            'task': 'State',
            'defect': 'State',
            'testcase':'LastVerdict'
        };

        var header_text = {
            'task': 'Task',
            'defect': 'Defect',
            'testcase':'Test'
        };

        var cols = [
            {
                dataIndex:'FormattedID',
                text:header_text[type] + ' ID - Name',
                flex: 1,
                renderer: function(value,meta,record){
                    var link = Rally.nav.Manager.getDetailUrl(record);

                    return Ext.String.format('<a target="_top" href="{0}">{1} - {2}</a>',
                        link,
                        record.get('FormattedID'),
                        record.get('Name')
                    );
                }
            },
            {dataIndex:state_fields[type],text:'State'}
        ];

        return cols;
    }
});
