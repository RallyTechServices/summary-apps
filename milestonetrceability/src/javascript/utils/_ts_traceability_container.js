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
         //       layout: 'hbox',
                defaults: { margins: 5, padding: 5 }
            });

            if ( !this._hasChildren(artifact) ) {
                subcontainer.update('No Children Artifacts');
                //container.add({xtype:'container',html:'No Children Artifacts'});
            } else {
                 var grid_box = container.add({
                      xtype:'container',
                      layout: 'hbox',
                      defaults: { margin: 5, padding: 5 },
                      html:''
                 });
                 grid_box.add(this._getGridFor('task',artifact));
                 grid_box.add(this._getGridFor('defect',artifact));
                 grid_box.add(this._getGridFor('testcase',artifact));
            }
        },this);
    },

    _getArtifactSummaryTemplate: function() {
        return new Ext.XTemplate('<b>{FormattedID} {Name}</b> - ( Plan Estimate: {PlanEstimate} ) - {ScheduleState}');
    },

    _getGridFor: function(type,artifact){
        var fieldname = "__" + type + "s";
        var columns = this._getColumns(type);
        var store = Ext.create('Rally.data.custom.Store',{
            data: artifact.get(fieldname)
        });

        return( {
            xtype:'rallygrid',
            columnCfgs: columns,
            store: store,
            flex: 1,
            cls: 'ts-grid',
            showPagingToolbar: false,
            showRowActionsColumn: false
        });
    },

    _getColumns: function(type) {
        var state_fields = {
            'task': 'State',
            'defect': 'State',
            'testcase':'LastVerdict'
        };
        var cols = [
            {
                dataIndex:'FormattedID',
                text:'ID - Name',
                flex: 1,
                renderer: function(value,meta,record){
                    return record.get('FormattedID') + ' - ' + record.get('Name');
                }
            },
            {dataIndex:state_fields[type],text:'State'}
        ];

        return cols;
    }
});